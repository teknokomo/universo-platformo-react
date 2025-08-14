import { z } from 'zod';
export declare const schemas: {
    position: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        z: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        z: number;
    }, {
        x: number;
        y: number;
        z: number;
    }>;
    rotation: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        z: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        z: number;
    }, {
        x: number;
        y: number;
        z: number;
    }>;
    baseObject: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
    }, z.ZodTypeAny, "passthrough">>;
    object: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        geometry: z.ZodOptional<z.ZodObject<{
            width: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            depth: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            radius: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            segments: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }>>;
        material: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                r: z.ZodNumber;
                g: z.ZodNumber;
                b: z.ZodNumber;
                a: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }>>>;
            texture: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            opacity: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            metalness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            roughness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }>>;
        model: z.ZodOptional<z.ZodObject<{
            src: z.ZodString;
            format: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            src: string;
            format?: string | undefined;
        }, {
            src: string;
            format?: string | undefined;
        }>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        geometry: z.ZodOptional<z.ZodObject<{
            width: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            depth: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            radius: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            segments: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }>>;
        material: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                r: z.ZodNumber;
                g: z.ZodNumber;
                b: z.ZodNumber;
                a: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }>>>;
            texture: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            opacity: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            metalness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            roughness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }>>;
        model: z.ZodOptional<z.ZodObject<{
            src: z.ZodString;
            format: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            src: string;
            format?: string | undefined;
        }, {
            src: string;
            format?: string | undefined;
        }>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>;
        rotation: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        scale: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
        }, {
            x: number;
            y: number;
            z: number;
        }>>;
        geometry: z.ZodOptional<z.ZodObject<{
            width: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            depth: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            radius: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            segments: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }, {
            width?: number | undefined;
            height?: number | undefined;
            depth?: number | undefined;
            radius?: number | undefined;
            segments?: number | undefined;
        }>>;
        material: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                r: z.ZodNumber;
                g: z.ZodNumber;
                b: z.ZodNumber;
                a: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }, {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            }>>>;
            texture: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            opacity: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            metalness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            roughness: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }, {
            color?: {
                r: number;
                g: number;
                b: number;
                a?: number | undefined;
            } | undefined;
            texture?: string | undefined;
            opacity?: number | undefined;
            metalness?: number | undefined;
            roughness?: number | undefined;
        }>>;
        model: z.ZodOptional<z.ZodObject<{
            src: z.ZodString;
            format: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            src: string;
            format?: string | undefined;
        }, {
            src: string;
            format?: string | undefined;
        }>>;
    }, z.ZodTypeAny, "passthrough">>;
    entity: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        entityType: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            rotation: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            scale: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        entityType: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            rotation: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            scale: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        entityType: z.ZodOptional<z.ZodString>;
        transform: z.ZodOptional<z.ZodObject<{
            position: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            rotation: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
            scale: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                z: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                z: number;
            }, {
                x: number;
                y: number;
                z: number;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }, {
            position?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            rotation?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
            scale?: {
                x: number;
                y: number;
                z: number;
            } | undefined;
        }>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodString;
            componentType: z.ZodString;
            primitive: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            scriptName: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">>;
};
