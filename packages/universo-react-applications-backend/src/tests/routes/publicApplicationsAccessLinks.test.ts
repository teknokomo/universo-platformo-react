import {
    applicationId,
    schemaName,
    contentNodeId,
    quizId,
    accessLinkId,
    workspaceId1,
    workspaceId2,
    withPublicApplication,
    buildRevokedAttemptRaceDataSource,
    buildDataSource,
    buildApp,
    request,
    codenameVlc,
    localizedTextVlc,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes: access links', () => {
    installPublicApplicationsTestHooks()

    it('requires a UUID v7 attempt path and a strict revision-bound Continue body', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false })
        const app = buildApp(race.dataSource)
        const body = { participantId: race.participantId, sessionToken: race.sessionToken, phaseRevision: 0 }

        await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/018f8a78-7b8f-4c1d-a111-222233334422/continue`)
            .send(body)
            .expect(404)
        await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/continue`)
            .send({ ...body, unexpected: true })
            .expect(400)

        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
    })

    it('continues the current block intro and treats a committed duplicate Continue as an idempotent read', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, existingAttempt: true, blockedAttempt: true })
        const app = buildApp(race.dataSource)
        const path = `/public/a/${applicationId}/runtime/attempts/${race.attemptId}/continue`
        const body = { participantId: race.participantId, sessionToken: race.sessionToken, phaseRevision: 0 }

        const first = await request(app).post(path).send(body).expect(200)
        expect(first.body).toMatchObject({
            status: 'in_progress',
            phase: 'question',
            phaseRevision: 1,
            numberingMode: 'block',
            currentQuestionIndex: 0,
            answeredCount: 0,
            questions: [{ id: race.questionId, displayNumber: '1.1' }]
        })
        expect(first.body).not.toHaveProperty('flowSnapshot')
        expect(first.body).not.toHaveProperty('blockKey')
        expect(first.body.currentBlock).toBeNull()

        const duplicate = await request(app).post(path).send(body).expect(200)
        expect(duplicate.body).toMatchObject({
            status: first.body.status,
            phase: first.body.phase,
            phaseRevision: first.body.phaseRevision,
            currentQuestionIndex: first.body.currentQuestionIndex,
            answeredCount: first.body.answeredCount,
            questions: first.body.questions
        })
        expect(race.attemptQueries.filter((sql) => /^\s*UPDATE\s/i.test(sql))).toHaveLength(1)
    })

    it('serializes concurrent Continue requests for the same block intro', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            existingAttempt: true,
            blockedAttempt: true,
            serializeAdvisoryLocks: true
        })
        const app = buildApp(race.dataSource)
        const path = `/public/a/${applicationId}/runtime/attempts/${race.attemptId}/continue`
        const body = { participantId: race.participantId, sessionToken: race.sessionToken, phaseRevision: 0 }

        const responses = await Promise.all([request(app).post(path).send(body), request(app).post(path).send(body)])

        for (const response of responses) {
            expect(response.status).toBe(200)
            expect(response.body).toMatchObject({
                status: 'in_progress',
                phase: 'question',
                phaseRevision: 1,
                currentQuestionIndex: 0,
                answeredCount: 0,
                questions: [{ id: race.questionId, displayNumber: '1.1' }]
            })
        }
        expect(race.attemptQueries.filter((sql) => /^\s*UPDATE\s/i.test(sql))).toHaveLength(1)
    })

    it('returns the committed next-block state when the final answer write is retried after a lost response', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            existingAttempt: true,
            blockedAttempt: true,
            blockTransitionAttempt: true
        })
        const app = buildApp(race.dataSource)

        const response = await request(app)
            .put(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/answers`)
            .send({
                participantId: race.participantId,
                sessionToken: race.sessionToken,
                questionId: race.questionId,
                optionId: '018f8a78-7b8f-7c1d-a111-222233334424'
            })
            .expect(200)

        expect(response.body).toMatchObject({
            ok: true,
            attempt: {
                status: 'in_progress',
                phase: 'block_intro',
                phaseRevision: 1,
                currentQuestionIndex: 1,
                answeredCount: 1,
                currentBlock: { title: 'Orbits' },
                questions: []
            }
        })
        expect(race.dataSource.transactionSql.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
        expect(race.attemptQueries.filter((sql) => /^\s*UPDATE\s/i.test(sql))).toHaveLength(0)
    })

    it('returns a committed final answer after completion and rejects a different retry', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, existingAttempt: true, completedAttempt: true })
        const app = buildApp(race.dataSource)
        const path = `/public/a/${applicationId}/runtime/attempts/${race.attemptId}/answers`
        const body = { participantId: race.participantId, sessionToken: race.sessionToken, questionId: race.questionId }

        const retry = await request(app)
            .put(path)
            .send({ ...body, optionId: '018f8a78-7b8f-7c1d-a111-222233334424' })
            .expect(200)

        expect(retry.body).toMatchObject({
            ok: true,
            attempt: {
                status: 'completed',
                currentQuestionIndex: 1,
                answeredCount: 1,
                result: { total: 1, finishedReason: 'submitted' }
            }
        })

        const conflictingRetry = await request(app)
            .put(path)
            .send({ ...body, optionId: '018f8a78-7b8f-7c1d-a111-222233334425' })
            .expect(409)

        expect(conflictingRetry.body).toMatchObject({ error: 'Answer could not be saved' })
        expect(race.dataSource.transactionSql.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
        expect(race.attemptQueries.some((sql) => /^\s*UPDATE\s/i.test(sql))).toBe(false)
    })

    it.each([
        ['answer writes', 'put' as const, 'answers'],
        ['continue writes', 'post' as const, 'continue'],
        ['finalize writes', 'post' as const, 'finalize']
    ])('rechecks and locks the access link before %s reads or writes attempt data', async (_name, method, action) => {
        const race = buildRevokedAttemptRaceDataSource()
        const app = buildApp(race.dataSource)
        const path = `/public/a/${applicationId}/runtime/attempts/${race.attemptId}/${action}`
        const payload = { participantId: race.participantId, sessionToken: race.sessionToken }
        const req = request(app)[method](path)
        if (action === 'answers') {
            req.send({ ...payload, questionId: race.attemptId, optionId: 'option-1' })
        } else if (action === 'continue') {
            req.send({ ...payload, phaseRevision: 0 })
        } else {
            req.send(payload)
        }
        const response = await req.expect(404)

        expect(response.body).toEqual({ error: 'Quiz attempt not found' })
        expect(
            race.dataSource.transactionSql.some(
                (sql) => sql.includes('FROM "' + schemaName + '"."access_links_table"') && sql.includes('FOR UPDATE')
            )
        ).toBe(true)
        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
        expect(race.dataSource.transactionSql.some((sql) => /^\s*(INSERT|UPDATE|DELETE)\s/i.test(sql))).toBe(false)
    })

    it('does not read an assessment snapshot when the current access link is already revoked', async () => {
        const race = buildRevokedAttemptRaceDataSource({ alreadyRevoked: true })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(404)

        expect(response.body).toEqual({ error: 'Quiz attempt not found' })
        expect(race.attemptQueries.every((sql) => !sql.includes('"questions_snapshot"'))).toBe(true)
        expect(race.responseQueries).toEqual([])
    })

    it('does not read quiz questions through a hard-revoked access link', async () => {
        const race = buildRevokedAttemptRaceDataSource({ alreadyRevoked: true })
        const app = buildApp(race.dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=revoked-quiz`).expect(403)

        expect(response.body).toEqual({ error: 'Access link is inactive' })
        expect(race.dataSource.transactionSql.some((sql) => sql.includes('FOR UPDATE'))).toBe(true)
        expect(race.quizQueries).toEqual([])
    })

    it('finalizes a started attempt and never returns its quiz after the access link is revoked', async () => {
        const race = buildRevokedAttemptRaceDataSource({ alreadyRevoked: true, existingAttempt: true })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=revoked-quiz&targetType=quiz&targetId=${quizId}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(403)

        expect(response.body).toEqual({ error: 'Access link is inactive' })
        expect(race.attemptQueries.some((sql) => /^\s*UPDATE\s/i.test(sql))).toBe(true)
        expect(race.quizQueries).toEqual([])
    })

    it('requires a guest session before reading quiz questions from an active access link', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false })
        const app = buildApp(race.dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=revoked-quiz`).expect(403)

        expect(response.body).toEqual({ error: 'Guest session is required to access quiz questions' })
        expect(race.quizQueries).toEqual([])
    })

    it('resolves an expired access link only for its still-valid guest session', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, expiresAt: '2000-01-01T00:00:00.000Z' })
        const app = buildApp(race.dataSource)
        const path = `/public/a/${applicationId}/links/revoked-quiz`

        const resumed = await request(app)
            .get(path)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(200)
        expect(resumed.body.id).toBe(race.linkId)

        await request(app).get(path).expect(403)
    })

    it('resolves a global guest link by immutable identity and rejects a replacement slug', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false })
        const app = buildApp(race.dataSource)

        const response = await request(app)
            .get(`/public/a/${applicationId}/links/replacement-quiz`)
            .query({ accessLinkId: race.linkId })
            .expect(404)

        expect(response.body).toEqual({ error: 'Access link not found' })
        const accessLinkQuery = race.dataSource.queryCalls.find(({ sql }) => sql.includes(`FROM "${schemaName}"."access_links_table"`))
        expect(accessLinkQuery?.sql).toContain('WHERE id = $1')
        expect(accessLinkQuery?.params).toEqual([race.linkId])
    })

    it('rejects malformed immutable access-link identities before querying public data', async () => {
        const race = buildRevokedAttemptRaceDataSource()
        const app = buildApp(race.dataSource)

        const response = await request(app)
            .get(`/public/a/${applicationId}/links/revoked-quiz`)
            .query({ accessLinkId: 'not-a-uuid' })
            .expect(400)

        expect(response.body).toEqual({ error: 'Invalid access link identity' })
        expect(race.dataSource.queryCalls).toHaveLength(0)
    })

    it('rejects malformed and repeated locales when resolving a public access link', async () => {
        const race = buildRevokedAttemptRaceDataSource()
        const app = buildApp(race.dataSource)

        const invalidLocaleResponse = await request(app)
            .get(`/public/a/${applicationId}/links/revoked-quiz?locale=en&locale=ru`)
            .expect(400)
        expect(invalidLocaleResponse.headers['cache-control']).toBe('no-store')
        await request(app).get(`/public/a/${applicationId}/links/revoked-quiz?locale=english--ru`).expect(400)
    })

    it('resumes an existing guest attempt after its active access link expires', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            expiresAt: '2000-01-01T00:00:00.000Z',
            existingAttempt: true
        })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=revoked-quiz&targetType=quiz&targetId=${quizId}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(200)

        expect(response.body).toMatchObject({ type: 'quiz', id: quizId })
        expect(race.attemptQueries.some((sql) => sql.includes('SELECT'))).toBe(true)
    })

    it('does not open an expired quiz runtime for a guest session without an existing attempt', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            expiresAt: '2000-01-01T00:00:00.000Z'
        })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=revoked-quiz&targetType=quiz&targetId=${quizId}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(403)

        expect(response.body.error).toBe('Access link has expired')
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
    })

    it('finalizes an in-progress attempt when its access link is hard-revoked', async () => {
        const race = buildRevokedAttemptRaceDataSource({ alreadyRevoked: true, existingAttempt: true })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(200)

        expect(response.body).toMatchObject({
            attemptId: race.attemptId,
            status: 'completed',
            result: { score: 0, total: 1, passed: false, finishedReason: 'revoked' },
            currentQuestionIndex: 1,
            totalQuestions: 1,
            answeredCount: 0
        })
        expect(response.body.questions).toEqual([])
        expect(response.body).not.toHaveProperty('answeredQuestionIds')
        expect(response.headers['cache-control']).toBe('no-store')
        expect(race.attemptQueries.some((sql) => /^\s*UPDATE\s/i.test(sql))).toBe(true)
        expect(race.responseQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
    })

    it('continues an existing started attempt after its active access link expires', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            expiresAt: '2000-01-01T00:00:00.000Z',
            existingAttempt: true
        })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(200)

        expect(response.body).toMatchObject({ attemptId: race.attemptId, status: 'in_progress' })
        expect(race.dataSource.transactionSql.some((sql) => sql.includes('FOR UPDATE'))).toBe(true)
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
    })

    it('resumes the stored question snapshot without rebuilding an unavailable quiz', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, existingAttempt: true, quizUnavailable: true })
        const app = buildApp(race.dataSource)

        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(200)

        expect(response.body).toMatchObject({ attemptId: race.attemptId, status: 'in_progress', totalQuestions: 1 })
        expect(race.quizQueries).toEqual([])
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
    })

    it('blocks a new attempt allocation after its active access link expires', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, expiresAt: '2000-01-01T00:00:00.000Z' })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(409)

        expect(response.body).toEqual({ error: 'Quiz access is no longer available', code: 'GUEST_QUIZ_ACCESS_UNAVAILABLE' })
        expect(race.dataSource.transactionSql.some((sql) => sql.includes('FOR UPDATE'))).toBe(true)
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
    })

    it('rejects attempt allocation when the locked access link has been retargeted', async () => {
        const race = buildRevokedAttemptRaceDataSource({ revokeDuringMutation: false, retargetDuringMutation: true })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(409)

        expect(response.body).toEqual({ error: 'Quiz access is no longer available', code: 'GUEST_QUIZ_ACCESS_UNAVAILABLE' })
        expect(race.accessLinkTargetIds).toContain(quizId)
        expect(race.accessLinkTargetIds).toContain(race.retargetedQuizId)
        expect(
            race.dataSource.transactionSql.some(
                (sql) => sql.includes(`FROM "${schemaName}"."access_links_table"`) && /FOR UPDATE/i.test(sql)
            )
        ).toBe(true)
        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
    })

    it('rejects attempt allocation when a content item no longer links the quiz after its parent is locked', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            contentTarget: true,
            unlinkContentQuizDuringMutation: true
        })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(409)

        expect(response.body).toEqual({ error: 'Quiz access is no longer available', code: 'GUEST_QUIZ_ACCESS_UNAVAILABLE' })
        expect(
            race.dataSource.transactionSql.some(
                (sql) => sql.includes(`FROM "${schemaName}"."learning_resources_table"`) && /FOR UPDATE/i.test(sql)
            )
        ).toBe(true)
        expect(
            race.dataSource.queryCalls.some(({ sql, scope }) => scope === 'tx' && sql.includes(`FROM "${schemaName}"."content_items"`))
        ).toBe(true)
        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
    })

    it('locks application then workspace before the content link without re-reading the quiz', async () => {
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            contentTarget: true,
            existingAttempt: true,
            workspaceId: workspaceId1
        })
        const app = buildApp(race.dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(200)

        expect(response.body).toMatchObject({ attemptId: race.attemptId, status: 'in_progress' })
        const applicationLockIndex = race.dataSource.transactionSql.findIndex(
            (sql) => sql.includes('FROM applications.obj_applications a') && /FOR SHARE/i.test(sql)
        )
        const workspaceLockIndex = race.dataSource.transactionSql.findIndex(
            (sql) => sql.includes(`."_app_workspaces"`) && /FOR UPDATE/i.test(sql)
        )
        expect(applicationLockIndex).toBeGreaterThanOrEqual(0)
        expect(workspaceLockIndex).toBeGreaterThan(applicationLockIndex)
        expect(
            race.dataSource.transactionSql.some(
                (sql) => sql.includes(`FROM "${schemaName}"."learning_resources_table"`) && /FOR UPDATE/i.test(sql)
            )
        ).toBe(true)
        expect(race.quizQueries).toEqual([])
    })

    it('rejects a guest attempt when its session is revoked and the link is re-enabled while start waits for its lock', async () => {
        let signalAccessLinkLockReached: () => void = () => undefined
        const accessLinkLockGate: { release: (() => void) | null } = { release: null }
        const accessLinkLockReached = new Promise<void>((resolve) => {
            signalAccessLinkLockReached = resolve
        })
        const waitForAccessLinkLock = new Promise<void>((resolve) => {
            accessLinkLockGate.release = resolve
        })
        const race = buildRevokedAttemptRaceDataSource({
            revokeDuringMutation: false,
            beforeTransactionalAccessLinkLock: async () => {
                signalAccessLinkLockReached()
                await waitForAccessLinkLock
            }
        })
        const app = buildApp(race.dataSource)

        const responsePromise = request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .then((response) => response)
        await accessLinkLockReached
        race.revokeAndReenableAccessLink()
        if (!accessLinkLockGate.release) throw new Error('Access-link lock gate was not initialized')
        accessLinkLockGate.release()
        const response = await responsePromise

        expect(response.status).toBe(409)
        expect(response.body).toEqual({ error: 'Quiz access is no longer available', code: 'GUEST_QUIZ_ACCESS_UNAVAILABLE' })
        expect(race.accessLinkMutationStates).toEqual([false, true])
        const lockedLinkRead = race.dataSource.queryCalls.findIndex(
            ({ sql, scope }) => scope === 'tx' && sql.includes(`FROM "${schemaName}"."access_links_table"`) && /FOR UPDATE/i.test(sql)
        )
        const transactionalSessionRevalidation = race.dataSource.queryCalls.reduce(
            (lastIndex, { sql, scope }, index) =>
                scope === 'tx' && sql.includes(`FROM "${schemaName}"."students_table"`) ? index : lastIndex,
            -1
        )
        expect(lockedLinkRead).toBeGreaterThanOrEqual(0)
        expect(transactionalSessionRevalidation).toBeGreaterThan(lockedLinkRead)
        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
        expect(race.accessLinkActiveStates.length).toBeGreaterThan(0)
        expect(race.accessLinkActiveStates).not.toContain(false)
    }, 15_000)

    it.each(['get', 'answer', 'finalize'] as const)(
        'does not let an in-flight %s request use a guest session revoked while waiting for the access-link lock',
        async (action) => {
            const race = buildRevokedAttemptRaceDataSource({
                revokeDuringMutation: false,
                existingAttempt: true,
                revokeGuestSessionOnTransactionalRevalidation: true
            })
            const app = buildApp(race.dataSource)
            const session = { participantId: race.participantId, sessionToken: race.sessionToken }
            const response =
                action === 'get'
                    ? await request(app)
                          .get(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}`)
                          .set('X-Guest-Participant-Id', session.participantId)
                          .set('X-Guest-Session-Token', session.sessionToken)
                          .expect(404)
                    : action === 'answer'
                    ? await request(app)
                          .put(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/answers`)
                          .send({ ...session, questionId: race.questionId, optionId: '018f8a78-7b8f-7c1d-a111-222233334424' })
                          .expect(404)
                    : await request(app)
                          .post(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/finalize`)
                          .send(session)
                          .expect(404)

            expect(response.body).toEqual({ error: 'Quiz attempt not found' })
            expect(race.accessLinkActiveStates.length).toBeGreaterThan(0)
            expect(race.accessLinkActiveStates).not.toContain(false)
            const lockedLinkRead = race.dataSource.queryCalls.findIndex(
                ({ sql, scope }) => scope === 'tx' && sql.includes(`FROM "${schemaName}"."access_links_table"`) && /FOR UPDATE/i.test(sql)
            )
            const transactionalSessionRevalidation = race.dataSource.queryCalls.reduce(
                (lastIndex, { sql, scope }, index) =>
                    scope === 'tx' && sql.includes(`FROM "${schemaName}"."students_table"`) ? index : lastIndex,
                -1
            )
            expect(lockedLinkRead).toBeGreaterThanOrEqual(0)
            expect(transactionalSessionRevalidation).toBeGreaterThan(lockedLinkRead)
            expect(race.attemptQueries).toEqual([])
            expect(race.responseQueries).toEqual([])
        }
    )

    it('fails cleanly when a quiz has a non-v7 option identity and creates no partial attempt', async () => {
        const race = buildRevokedAttemptRaceDataSource({ invalidQuestionOptionId: true, revokeDuringMutation: false })
        const app = buildApp(race.dataSource)

        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start`)
            .send({ participantId: race.participantId, sessionToken: race.sessionToken, assessmentId: quizId })
            .expect(422)

        expect(response.body).toEqual({ error: 'Quiz configuration is invalid', code: 'GUEST_QUIZ_CONFIGURATION_INVALID' })
        expect(race.attemptQueries.some((sql) => /^\s*INSERT\s/i.test(sql))).toBe(false)
        expect(race.dataSource.isInTransaction()).toBe(false)
    })

    it('rejects malformed or repeated locales on guest quiz attempt routes', async () => {
        const race = buildRevokedAttemptRaceDataSource({ existingAttempt: true })
        const app = buildApp(race.dataSource)
        const localeQuery = '?locale=en&locale=ru'
        const session = { participantId: race.participantId, sessionToken: race.sessionToken }

        await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start${localeQuery}`)
            .send({ ...session, assessmentId: quizId })
            .expect(400)
        await request(app)
            .get(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}${localeQuery}`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(400)
        await request(app)
            .put(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/answers${localeQuery}`)
            .send({ ...session, questionId: quizId, optionId: 'option-1' })
            .expect(400)
        await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/finalize${localeQuery}`)
            .send(session)
            .expect(400)
        await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/${race.attemptId}/continue${localeQuery}`)
            .send({ ...session, phaseRevision: 0 })
            .expect(400)

        expect(race.attemptQueries).toEqual([])
        expect(race.responseQueries).toEqual([])
    })

    it('rejects malformed or repeated locales on guest runtime routes before reading runtime data', async () => {
        const race = buildRevokedAttemptRaceDataSource()
        const app = buildApp(race.dataSource)

        await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=revoked-quiz&locale=en&locale=ru`)
            .set('X-Guest-Participant-Id', race.participantId)
            .set('X-Guest-Session-Token', race.sessionToken)
            .expect(400)
        await request(app).get(`/public/a/${applicationId}/runtime?slug=revoked-quiz&locale=english--ru`).expect(400)

        expect(race.quizQueries).toEqual([])
        expect(race.attemptQueries).toEqual([])
    })

    it('resolves a public access link from the workspace that actually owns the link', async () => {
        let currentWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-content-ref',
                                codename: codenameVlc('ContentNodeIdRef'),
                                column_name: 'content_node_id_ref',
                                data_type: 'REF',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-show-first-name',
                                codename: codenameVlc('ShowFirstName'),
                                column_name: 'show_first_name',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: quizId,
                                      content_node_id_ref: contentNodeId,
                                      is_active: true,
                                      shows_first_name: true
                                  }
                              ]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body.id).toBe(accessLinkId)
        expect(response.body.targetId).toBe(contentNodeId)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(currentWorkspaceId).toBe(workspaceId2)
    })

    it('fails closed when the same public access-link slug exists in multiple active public workspaces', async () => {
        let currentWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-show-first-name',
                                codename: codenameVlc('ShowFirstName'),
                                column_name: 'show_first_name',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return [
                            {
                                id: currentWorkspaceId === workspaceId2 ? accessLinkId : '4ea1c528-0868-44b6-a30b-7e63a9f963db',
                                slug: 'demo-content',
                                target_type: 'content',
                                target_id: contentNodeId,
                                is_active: true
                            }
                        ]
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(404)

        expect(currentWorkspaceId).toBe('')
    })

    it('fails closed when the same public access-link slug exists more than once in one public workspace', async () => {
        let currentWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return [
                            {
                                id: accessLinkId,
                                slug: 'demo-content',
                                target_type: 'content',
                                target_id: contentNodeId,
                                is_active: true,
                                shows_first_name: true
                            },
                            {
                                id: '4ea1c528-0868-44b6-a30b-7e63a9f963db',
                                slug: 'demo-content',
                                target_type: 'quiz',
                                target_id: quizId,
                                is_active: true,
                                shows_first_name: true
                            }
                        ]
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(404)

        expect(currentWorkspaceId).toBe('')
    })

    it('pins workspace-aware public link resolution to one transaction-scoped executor', async () => {
        let rootWorkspaceId = ''
        let txWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params, scope) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        if (scope === 'tx') {
                            txWorkspaceId = String(params[0] ?? '')
                        } else {
                            rootWorkspaceId = String(params[0] ?? '')
                        }
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-show-first-name',
                                codename: codenameVlc('ShowFirstName'),
                                column_name: 'show_first_name',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return scope === 'tx' && txWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: contentNodeId,
                                      is_active: true,
                                      shows_first_name: true
                                  }
                              ]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body.id).toBe(accessLinkId)
        expect(txWorkspaceId).toBe(workspaceId2)
        expect(rootWorkspaceId).toBe('')
    })

    it('does not resolve public access links from personal workspaces', async () => {
        let currentWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        expect(sql).toContain("workspace_type <> 'personal'")
                        expect(sql).toContain('personal_user_id IS NULL')
                        return []
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-show-first-name',
                                codename: codenameVlc('ShowFirstName'),
                                column_name: 'show_first_name',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId1
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: contentNodeId,
                                      is_active: true,
                                      shows_first_name: true
                                  }
                              ]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(404)
    })

    it('resolves an active public access link by slug', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [
                        {
                            id: 'object-1',
                            codename: codenameVlc('AccessLinks'),
                            kind: 'object',
                            table_name: 'access_links_table',
                            config: {
                                recordPolicy: {
                                    version: 1,
                                    denyDeleteWhenBound: false,
                                    immutableSemanticKeyWhenBound: false,
                                    runtimeMutation: 'deny'
                                }
                            }
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        {
                            id: 'attr-1',
                            codename: codenameVlc('Slug'),
                            column_name: 'slug',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-2',
                            codename: codenameVlc('TargetType'),
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-3',
                            codename: codenameVlc('TargetId'),
                            column_name: 'target_id',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-4',
                            codename: codenameVlc('IsActive'),
                            column_name: 'is_active',
                            data_type: 'BOOLEAN',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-5',
                            codename: codenameVlc('UseCount'),
                            column_name: 'use_count',
                            data_type: 'NUMBER',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-6',
                            codename: codenameVlc('MaxUses'),
                            column_name: 'max_uses',
                            data_type: 'NUMBER',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-7',
                            codename: codenameVlc('LinkTitle'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-show-first-name',
                            codename: codenameVlc('ShowFirstName'),
                            column_name: 'show_first_name',
                            data_type: 'BOOLEAN',
                            parent_component_id: null
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-content',
                            target_type: 'content',
                            target_id: contentNodeId,
                            is_active: true,
                            expires_at: null,
                            max_uses: 5,
                            use_count: 0,
                            title: localizedTextVlc('Demo content', 'Демо-модуль'),
                            class_id: null,
                            shows_first_name: true
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body).toMatchObject({
            id: accessLinkId,
            slug: 'demo-content',
            targetType: 'content',
            title: 'Demo content'
        })
    })
})
