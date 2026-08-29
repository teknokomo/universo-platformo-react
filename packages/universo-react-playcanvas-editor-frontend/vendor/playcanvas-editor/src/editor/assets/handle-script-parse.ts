import { buildQueryUrl } from '@/common/utils';
import { WorkerClient } from '@/core/worker/worker-client';

editor.once('load', () => {
    const genGUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };

    const importEngine = async (url) => {
        if (url.endsWith('.mjs')) {
            return await import(url);
        }

        const res = await fetch(url);
        const text = await res.text();
        const module = {
            exports: {}
        };

        return (Function('module', 'exports', text).call(module, module, module.exports), module).exports;
    };

    const isEsmSupportedInEngine = (url) => {
        // a slow or failed engine fetch must not throw out of the parse path (which
        // would leave the parse callback unresolved); treat any failure as unsupported
        return importEngine(url)
            .then((pc) => !!pc?.Script)
            .catch(() => false);
    };

    const workerClient = new WorkerClient(`${config.url.frontend}js/esm-script.worker.js`);
    workerClient.once('init', async () => {
        const typesURL = config.url.engine.replace(/(\.min|\.dbg|\.prf)?\.js$/, '.d.ts');
        const res = await fetch(typesURL);
        const types = await res.text();
        // Shared module assets are user-defined and may not exist yet when the
        // first script is authored. Keep the parser's virtual TypeScript program
        // free of unresolved-import diagnostics until those assets are created.
        const sharedModuleTypes = `declare module '@shared/*' {
    export const AUTHORITATIVE_HARD_RESYNC_DISTANCE: any;
    export const CAMERA_COLLISION_HALF_EXTENTS: any;
    export const DEFAULT_GUARD_CLEARANCE: any;
    export const DEFAULT_PREDICTION_ACCELERATION: any;
    export const DEFAULT_PREDICTION_DECELERATION: any;
    export const DEFAULT_TURN_RESPONSE: any;
    export const MAX_TURN_RADIANS_PER_FRAME: any;
    export const REMOTE_SHIP_RENDER_CLEARANCE: any;
    export const clampSegmentBeforeObstacleContact: any;
    export const createAabbObstacleBox: any;
    export const createOrientedBox: any;
    export const distanceToAabbSurface: any;
    export const expandAabb: any;
    export const expandAabbForOrientedBody: any;
    export const lerpVector3: any;
    export const moveNumberTowards: any;
    export const moveTowards: any;
    export const normalizeForward: any;
    export const resolveCameraPositionOutsideGuardBoxes: any;
    export const resolveFollowCameraPosition: any;
    export const resolvePositionOutsideObstacle: any;
    export const rotateFollowCamera: any;
    export const rotateForwardTowards: any;
    export const vectorLength: any;
    export const zoomFollowCamera: any;
}`;
        let hasIncludedTypes = false;

        const reqState = new Map();

        const logStartParse = (asset, inEditor) => {
            if (inEditor) {
                editor.call('status:text', `Parsing script asset '${asset.get('name')}'...`);
            }
        };

        const checkForErrors = (res) => {
            if (res.scriptsInvalid?.length) {
                return res.scriptsInvalid;
            }
            for (const key in res.scripts) {
                const script = res.scripts[key];
                if (script.attributesInvalid?.length) {
                    return script.attributesInvalid;
                }
            }
            return null;
        };

        const handleParseResult = (guid, res, asset, callback, inEditor) => {
            if (inEditor) {
                const errors = checkForErrors(res);
                if (errors) {
                    editor.call('status:error', `There was an error while parsing script asset '${asset.get('name')}'`);
                    callback?.(null, res);
                    return;
                }
            }

            // Wait for the backend to finish setting the script attributes. The
            // bridge now reports both success and terminal failures; always
            // unbind the listener so a timed-out/retried parse cannot resolve
            // an old callback later.
            const eventName = `messenger:scriptAttrsFinished:${guid}`;
            let settled = false;
            const finish = (error, result) => {
                if (settled) return;
                settled = true;
                editor.unbind(eventName);
                if (inEditor) {
                    if (error) {
                        editor.call('status:error', error.message);
                    } else {
                        editor.call('status:clear');
                    }
                }
                callback?.(error || null, result || res);
            };
            editor.on(eventName, (message) => {
                const data = message?.data;
                if (data && data.ok === false) {
                    finish(new Error(`Script attributes pipeline failed (${data.code || 'unknown'})`));
                    return;
                }
                finish(null, res);
            });

            // Send the parsed script to the backend
            try {
                editor.call('realtime:send', 'pipeline', {
                    name: 'script-attributes',
                    data: {
                        script_task_type: 'handle_parsed_script',
                        job_id: guid,
                        parse_result: res,
                        project_id: config.project.id,
                        branch_id: config.self.branch.id,
                        asset_id: asset.get('id')
                    }
                });
            } catch (error) {
                finish(error instanceof Error ? error : new Error(String(error)));
            }
        };

        const postUrl = (asset) => {
            const encodedFileName = encodeURIComponent(asset.get('file.filename'));
            return buildQueryUrl(`/api/assets/${asset.get('id')}/file/${encodedFileName}`, {
                branchId: config.self.branch.id
            });
        };

        workerClient.on('attributes:parse', (guid, scripts, scriptsInvalid) => {
            if (!reqState.has(guid)) {
                return;
            }

            // Unpack request state
            const { callback, asset, inEditor } = reqState.get(guid);
            reqState.delete(guid);

            const res = {
                scripts,
                scriptsInvalid,
                loading: false
            };
            handleParseResult(guid, res, asset, callback, inEditor);
        });

        const fileCache = new Map();
        const getScripts = async (pathFilter = []) => {
            const assets = editor.call('assets:list') ?? [];

            // Get all the files that no longer exist. ie files in the cache, but not in esmScripts
            const deletedFiles = [];
            const esmPaths = new Set(
                assets
                    .filter((asset) => editor.call('assets:isModule', asset))
                    .map((asset) => editor.call('assets:virtualPath', asset))
            );

            // loop over the file cache, remove any files that do no exist in the script assets
            for (const path of fileCache.keys()) {
                if (!esmPaths.has(path)) {
                    deletedFiles.push(path);
                    fileCache.delete(path);
                }
            }

            const scripts = await Promise.all(
                assets.map(async (asset) => {
                    if (!editor.call('assets:isModule', asset)) {
                        return;
                    }

                    const path = editor.call('assets:virtualPath', asset);
                    if (pathFilter.includes(path)) {
                        return;
                    }

                    const hash = asset.get('file.hash');
                    if (fileCache.get(path) === hash) {
                        return;
                    }

                    // Attempt to fetch the script
                    try {
                        const url = editor.call('assets:realPath', asset);
                        const res = await fetch(url);
                        const content = await res.text();
                        fileCache.set(path, hash);
                        return [path, content];
                    } catch (e) {
                        console.error(`Failed to fetch ESM script ${path}`, e);
                    }
                })
            );

            return [scripts.filter((script) => !!script), deletedFiles];
        };

        const classicParse = (asset, inEditor, callback) => {
            const worker = new Worker('/editor/scene/js/classic-script.worker.js');
            worker.onmessage = (evt) => {
                worker.terminate();
                const res = evt.data;
                const guid = genGUID();
                handleParseResult(guid, res, asset, callback, inEditor);
            };

            worker.onerror = (err) => {
                if (inEditor) {
                    editor.call('status:error', 'There was an error while parsing a script');
                }
                console.log('worker onerror', err);
                callback?.(err, undefined);
            };

            logStartParse(asset, inEditor);

            worker.postMessage({
                url: inEditor ? asset.get('file.url') : postUrl(asset),
                engine: config.url.engine
            });
        };

        editor.method('scripts:handleParse', async (asset, inEditor, callback) => {
            if (editor.call('assets:isModule', asset)) {
                // FIXME: just check engine version directly
                if (!(await isEsmSupportedInEngine(config.url.engine))) {
                    const msg =
                        'ESM scripts are not supported in this version of the engine. Please update to the latest version.';
                    editor.call('status:error', msg);
                    // always settle the callback, otherwise assets.createScript() hangs
                    callback?.(new Error(msg), undefined);
                    return;
                }

                logStartParse(asset, inEditor);

                // Construct scripts
                const [newOrUpdatedScripts, deletedFiles] = await getScripts();

                // Include the types file if it hasn't been included yet
                if (!hasIncludedTypes) {
                    newOrUpdatedScripts.push(['/playcanvas.d.ts', types]);
                    // @playcanvas/attribute-parser resolves the `playcanvas` import
                    // through its `/playcanvas.js` path mapping. The hosted engine
                    // contract is intentionally a declaration-only file, so expose
                    // a tiny virtual module at that exact path and preserve the
                    // Script symbol identity used by getAllEsmScripts().
                    newOrUpdatedScripts.push([
                        '/playcanvas.js',
                        "// @ts-nocheck\nexport { Script, Quat, Vec3, Color, Entity, StandardMaterial } from '/playcanvas.d.ts';"
                    ]);
                    newOrUpdatedScripts.push(['/universo-shared-modules.d.ts', sharedModuleTypes]);
                    hasIncludedTypes = true;
                }

                const url = editor.call('assets:virtualPath', asset).split('?')[0];
                const guid = genGUID();

                // Cache the request state
                reqState.set(guid, { callback, asset, inEditor });

                workerClient.send('attributes:parse', guid, newOrUpdatedScripts, deletedFiles, url);
                return;
            }

            classicParse(asset, inEditor, callback);
        });
    });

    workerClient.once('ready', () => workerClient.send('init', config.url.frontend));
    workerClient.start();

    window.addEventListener('beforeunload', () => {
        workerClient.stop();
    });
});
