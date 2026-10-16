import {
    applicationId,
    schemaName,
    contentNodeId,
    quizId,
    accessLinkId,
    workspaceId1,
    workspaceId2,
    guestIdempotencyKey,
    withPublicApplication,
    withPublicQuizAccessLink,
    buildDataSource,
    buildApp,
    request,
    authBackend,
    codenameVlc,
    localizedTextVlc,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes: guest session intake', () => {
    installPublicApplicationsTestHooks()

    it('localizes public access link titles when locale is provided', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
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
                            id: 'attr-5',
                            codename: codenameVlc('LinkTitle'),
                            column_name: 'title',
                            data_type: 'STRING',
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
                            title: localizedTextVlc('Docking drill', 'Стыковочная тренировка')
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content?locale=ru`).expect(200)

        expect(response.body.title).toBe('Стыковочная тренировка')
    })

    it('rejects inactive access links', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: false }]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(403)
    })

    it('rejects expired access links', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'attr-5', codename: 'ExpiresAt', column_name: 'expires_at', data_type: 'DATETIME', parent_component_id: null }
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
                            expires_at: new Date('2000-01-01T00:00:00.000Z')
                        }
                    ]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(403)
    })

    it('rejects exhausted access links before creating a guest session', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'attr-5', codename: 'UseCount', column_name: 'use_count', data_type: 'NUMBER', parent_component_id: null },
                        { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null }
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
                            max_uses: 1,
                            use_count: 1
                        }
                    ]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({ firstName: 'Guest', lastName: 'Learner', accessLinkId, termsAccepted: true, privacyAccepted: true })
            .expect(403)
    })

    it('fails closed when an access link has a use limit but no usage counter', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'target-type',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'target-id', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'active', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'max-uses', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null }
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
                            max_uses: 1
                        }
                    ]
                }
                return undefined
            })
        )
        const app = buildApp(dataSource)

        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(503)
        await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({ firstName: 'Guest', lastName: 'Learner', accessLinkId, termsAccepted: true, privacyAccepted: true })
            .expect(503)

        const transactionSql = (dataSource as typeof dataSource & { transactionSql: string[] }).transactionSql.join('\n')
        expect(transactionSql).not.toContain(`UPDATE "${schemaName}"."access_links_table"`)
        expect(transactionSql).not.toContain('INSERT INTO')
    })

    it('rejects a guest-session mutation on a denied AccessLink Entity before consuming quota or creating a participant', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [
                        {
                            id: 'object-links',
                            codename: 'AccessLinks',
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
                        { id: 'slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'target-type',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'target-id', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'active', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'max-uses', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null },
                        { id: 'use-count', codename: 'UseCount', column_name: 'use_count', data_type: 'NUMBER', parent_component_id: null }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'protected-link',
                            target_type: 'content',
                            target_id: contentNodeId,
                            is_active: true,
                            max_uses: 5,
                            use_count: 0
                        }
                    ]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({ firstName: 'Guest', lastName: 'Learner', accessLinkId, termsAccepted: true, privacyAccepted: true })
            .expect(403)

        expect(response.body.code).toBe('RUNTIME_ENTITY_MUTATION_DENIED')
        const transactionSql = (dataSource as typeof dataSource & { transactionSql: string[] }).transactionSql.join('\n')
        expect(transactionSql).not.toContain(`UPDATE "${schemaName}"."access_links_table"`)
        expect(transactionSql).not.toContain('INSERT INTO')
    })

    it('requires an idempotency key and accessLinkId to create a guest session', async () => {
        const dataSource = buildDataSource(withPublicQuizAccessLink())
        const app = buildApp(dataSource)

        await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .send({ accessLinkId, termsAccepted: true, privacyAccepted: true })
            .expect(400)

        await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({ displayName: 'Guest Learner' })
            .expect(400)
    })

    it('keeps the displayName guest-session contract for non-quiz content links', async () => {
        const participantInsertCapture: { sql: string; params: unknown[] } = { sql: '', params: [] }
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return params[0] === 'AccessLinks'
                        ? [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                        : [{ id: 'object-students', codename: 'Students', kind: 'object', table_name: 'students_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'target-type',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'target-id',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'active',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }
                    return [
                        {
                            id: 'name',
                            codename: 'DisplayName',
                            column_name: 'display_name',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'guest', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_component_id: null },
                        {
                            id: 'token',
                            codename: 'GuestSessionToken',
                            column_name: 'guest_session_token',
                            data_type: 'STRING',
                            parent_component_id: null
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'legacy-content',
                            target_type: 'content',
                            target_id: contentNodeId,
                            is_active: true
                        }
                    ]
                }
                if (sql.includes(`INSERT INTO "${schemaName}"."students_table"`)) {
                    Object.assign(participantInsertCapture, { sql, params })
                    return [{ id: params[0] }]
                }
                if (sql.includes('FROM "applications"."obj_guest_session_idempotency"')) return []
                return undefined
            })
        )

        const response = await request(buildApp(dataSource))
            .post(`/public/a/${applicationId}/guest-session`)
            .send({ displayName: 'Guest Learner', accessLinkId })
            .expect(201)

        expect(response.body).toMatchObject({ participantId: expect.any(String), studentId: expect.any(String) })
        expect(response.body.sessionToken).toEqual(expect.any(String))
        expect(participantInsertCapture.sql).toContain('display_name')
        expect(participantInsertCapture.sql).not.toContain('terms_version')
        expect(participantInsertCapture.sql).not.toContain('privacy_version')
        expect(participantInsertCapture.params).toContain('Guest Learner')
    })

    it('validates link-configured CAPTCHA after the preflight transaction has ended', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return params[0] === 'AccessLinks'
                        ? [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                        : []
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'target-type',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'target-id', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'active', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        {
                            id: 'captcha-enabled',
                            codename: 'CaptchaEnabled',
                            column_name: 'captcha_enabled',
                            data_type: 'BOOLEAN',
                            parent_component_id: null
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'captcha-link',
                            target_type: 'content',
                            target_id: contentNodeId,
                            is_active: true,
                            captcha_enabled: true
                        }
                    ]
                }
                return undefined
            })
        )
        const captchaValidator = jest.spyOn(authBackend, 'validateRequiredGuestCaptcha').mockImplementation(async () => {
            expect(dataSource.isInTransaction()).toBe(false)
            return { success: true }
        })
        const app = buildApp(dataSource)

        await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({ accessLinkId, termsAccepted: true, privacyAccepted: true, captchaToken: 'valid-captcha-token' })
            .expect(400)

        expect(captchaValidator).toHaveBeenCalledWith('valid-captcha-token', expect.any(String))
    })

    it('ignores unrequested intake fields, serializes duplicate sessions, and rejects mismatched explicit identity or revoked links', async () => {
        let persistedState: unknown = null
        let persistedDisplayName: unknown = null
        let persistedParticipantId = ''
        let persistedIntake: Record<string, unknown> | null = null
        let participantInsertCount = 0
        let participantInsertSql = ''
        let participantInsertParams: unknown[] = []
        let linkUseCount = 0
        let linkExpired = false
        let linkActive = true
        const databaseParams: unknown[][] = []

        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                databaseParams.push(params)
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-students', codename: 'Students', kind: 'object', table_name: 'students_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'attr-2',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-5',
                                codename: 'UseCount',
                                column_name: 'use_count',
                                data_type: 'NUMBER',
                                parent_component_id: null
                            },
                            { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null }
                        ]
                    }

                    return [
                        {
                            id: 'attr-1',
                            codename: 'DisplayName',
                            column_name: 'display_name',
                            data_type: 'STRING',
                            validation_rules: { localized: true, versioned: true },
                            parent_component_id: null
                        },
                        {
                            id: 'first-name',
                            codename: 'FirstName',
                            column_name: 'first_name',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'last-name', codename: 'LastName', column_name: 'last_name', data_type: 'STRING', parent_component_id: null },
                        { id: 'email', codename: 'Email', column_name: 'email', data_type: 'STRING', parent_component_id: null },
                        { id: 'phone', codename: 'Phone', column_name: 'phone', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'terms-version',
                            codename: 'TermsVersion',
                            column_name: 'terms_version',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'terms-accepted-at',
                            codename: 'TermsAcceptedAt',
                            column_name: 'terms_accepted_at',
                            data_type: 'DATE',
                            parent_component_id: null
                        },
                        {
                            id: 'privacy-version',
                            codename: 'PrivacyVersion',
                            column_name: 'privacy_version',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'privacy-accepted-at',
                            codename: 'PrivacyAcceptedAt',
                            column_name: 'privacy_accepted_at',
                            data_type: 'DATE',
                            parent_component_id: null
                        },
                        { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_component_id: null },
                        {
                            id: 'attr-3',
                            codename: 'GuestSessionToken',
                            column_name: 'guest_session_token',
                            data_type: 'STRING',
                            parent_component_id: null
                        }
                    ]
                }

                if (sql.includes('FROM "applications"."obj_guest_session_idempotency"')) {
                    if (sql.trimStart().startsWith('DELETE')) {
                        if (
                            persistedIntake &&
                            typeof persistedIntake.expiresAt === 'string' &&
                            Date.parse(persistedIntake.expiresAt) <= Date.now()
                        ) {
                            persistedIntake = null
                        }
                        return []
                    }
                    return persistedIntake &&
                        typeof persistedIntake.expiresAt === 'string' &&
                        Date.parse(persistedIntake.expiresAt) > Date.now()
                        ? [persistedIntake]
                        : []
                }

                if (sql.includes('INSERT INTO "applications"."obj_guest_session_idempotency"')) {
                    persistedIntake = {
                        idempotencyKeyHash: params[0],
                        payloadHash: params[1],
                        applicationId: params[2],
                        accessLinkId: params[3],
                        workspaceId: params[4],
                        participantId: params[5],
                        expiresAt: params[6],
                        secretNonce: params[7],
                        secretCiphertext: params[8],
                        secretAuthTag: params[9]
                    }
                    return []
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: String(params[0] ?? accessLinkId),
                            slug: 'demo-content',
                            target_type: 'quiz',
                            target_id: quizId,
                            is_active: linkActive,
                            expires_at: linkExpired ? new Date('2000-01-01T00:00:00.000Z') : null,
                            max_uses: 2,
                            use_count: linkUseCount,
                            title: 'Demo content',
                            class_id: null
                        }
                    ]
                }

                if (sql.includes(`UPDATE "${schemaName}"."access_links_table"`)) {
                    if (!linkActive || linkExpired || linkUseCount >= 2) return []
                    linkUseCount += 1
                    return [{ id: accessLinkId }]
                }

                if (sql.includes(`INSERT INTO "${schemaName}"."students_table"`)) {
                    participantInsertCount += 1
                    participantInsertSql = sql
                    participantInsertParams = params
                    persistedParticipantId = String(params[0])
                    persistedDisplayName = params.find((value) => Boolean(value) && typeof value === 'object')
                    persistedState = params.find((value) => typeof value === 'string' && value.includes('"secretHash"'))
                    return [{ id: persistedParticipantId }]
                }

                if (sql.includes(`FROM "${schemaName}"."students_table"`) && sql.includes('guest_session_token')) {
                    return persistedState ? [{ id: persistedParticipantId, guest_session_token: persistedState }] : []
                }

                return undefined
            }),
            { serializeAdvisoryLocks: true }
        )

        const app = buildApp(dataSource)
        const intake = {
            firstName: 'Guest',
            lastName: 'Learner',
            displayName: 'unrequested@example.test',
            email: 'unrequested@example.test',
            phone: '+15555550100',
            accessLinkId,
            termsAccepted: true,
            privacyAccepted: true
        }
        const postIntake = (payload: Record<string, unknown>) =>
            request(app).post(`/public/a/${applicationId}/guest-session`).set('Idempotency-Key', guestIdempotencyKey).send(payload)
        const [firstResponse, concurrentReplay] = await Promise.all([
            postIntake({ ...intake, captchaToken: 'first-captcha-token' }),
            postIntake({ ...intake, captchaToken: 'refreshed-captcha-token' })
        ])
        expect([firstResponse.status, concurrentReplay.status].sort()).toEqual([200, 201])
        const response = firstResponse.status === 201 ? firstResponse : concurrentReplay
        const replay = firstResponse.status === 200 ? firstResponse : concurrentReplay

        expect(response.body.participantId).toEqual(expect.any(String))
        expect(response.body.studentId).toEqual(expect.any(String))
        expect(response.body.participantId).toBe(response.body.studentId)
        expect(response.body.sessionToken).toEqual(expect.any(String))
        expect(typeof persistedState).toBe('string')
        expect(persistedDisplayName).toEqual(
            expect.objectContaining({
                _primary: 'en',
                locales: expect.objectContaining({
                    en: expect.objectContaining({ content: 'Guest' })
                })
            })
        )
        const participantInsertPayload = JSON.stringify(participantInsertParams)
        expect(participantInsertSql).toContain('"first_name"')
        for (const unrequestedColumn of ['last_name', 'email', 'phone']) {
            expect(participantInsertSql).not.toContain(unrequestedColumn)
        }
        for (const unrequestedValue of ['Learner', intake.displayName, intake.email, intake.phone, 'Guest Learner']) {
            expect(participantInsertPayload).not.toContain(unrequestedValue)
        }
        expect(persistedState).not.toBe(response.body.sessionToken)
        expect(JSON.parse(String(persistedState))).toEqual(
            expect.objectContaining({
                linkId: accessLinkId,
                secretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
                expiresAt: expect.any(String),
                workspaceId: null
            })
        )
        expect(JSON.parse(String(persistedState))).not.toEqual(expect.objectContaining({ secret: expect.any(String) }))

        expect(replay.body).toEqual(response.body)
        expect(participantInsertCount).toBe(1)
        expect(linkUseCount).toBe(1)
        expect(persistedIntake).not.toBeNull()
        expect(JSON.stringify(persistedIntake)).not.toContain(guestIdempotencyKey)
        expect(JSON.stringify(persistedIntake)).not.toContain('captcha-token')
        expect(databaseParams.flat()).not.toContain(guestIdempotencyKey)
        expect(databaseParams.flat()).not.toContain('first-captcha-token')
        expect(databaseParams.flat()).not.toContain('refreshed-captcha-token')
        expect(dataSource.transactionSql.join('\n')).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))')

        linkExpired = true
        const postExpiryReplay = await postIntake({ ...intake, captchaToken: 'new-captcha-token' }).expect(200)
        expect(postExpiryReplay.body).toEqual(response.body)
        expect(linkUseCount).toBe(1)
        expect(participantInsertCount).toBe(1)

        linkExpired = false
        const expiryIntake = persistedIntake as Record<string, unknown> | null
        if (expiryIntake) expiryIntake['expiresAt'] = '2000-01-01T00:00:00.000Z'
        const afterIdempotencyExpiry = await postIntake(intake).expect(201)
        expect(afterIdempotencyExpiry.body.participantId).not.toBe(response.body.participantId)
        expect(linkUseCount).toBe(2)
        expect(participantInsertCount).toBe(2)

        await postIntake({ ...intake, lastName: 'Ignored surname', email: 'other@example.test', phone: '+15555550999' }).expect(200)
        await postIntake({ ...intake, displayName: 'Different guest' }).expect(200)
        await postIntake({ ...intake, accessLinkId: '4ea1c528-0868-44b6-a30b-7e63a9f963da' }).expect(409)
        expect(linkUseCount).toBe(2)
        expect(participantInsertCount).toBe(2)

        linkActive = false
        await postIntake(intake).expect(403)
    })

    it('includes the resolved workspace id inside guest session transport tokens for workspace-enabled apps', async () => {
        let currentWorkspaceId = ''
        const accessLinkQueryScopes: string[] = []

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        if (sql.includes('WHERE "id" = $1')) return [{ id: String(params[0]) }]
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        if (params[0] === 'AccessLinks') {
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                        }
                        return [{ id: 'object-students', codename: 'Students', kind: 'object', table_name: 'students_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                                {
                                    id: 'attr-2',
                                    codename: 'TargetType',
                                    column_name: 'target_type',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-3',
                                    codename: 'TargetId',
                                    column_name: 'target_id',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-4',
                                    codename: 'IsActive',
                                    column_name: 'is_active',
                                    data_type: 'BOOLEAN',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-5',
                                    codename: 'UseCount',
                                    column_name: 'use_count',
                                    data_type: 'NUMBER',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-6',
                                    codename: 'MaxUses',
                                    column_name: 'max_uses',
                                    data_type: 'NUMBER',
                                    parent_component_id: null
                                }
                            ]
                        }

                        return [
                            {
                                id: 'attr-1',
                                codename: 'DisplayName',
                                column_name: 'display_name',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'first-name',
                                codename: 'FirstName',
                                column_name: 'first_name',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'last-name',
                                codename: 'LastName',
                                column_name: 'last_name',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            { id: 'email', codename: 'Email', column_name: 'email', data_type: 'STRING', parent_component_id: null },
                            { id: 'phone', codename: 'Phone', column_name: 'phone', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'terms-version',
                                codename: 'TermsVersion',
                                column_name: 'terms_version',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'terms-accepted-at',
                                codename: 'TermsAcceptedAt',
                                column_name: 'terms_accepted_at',
                                data_type: 'DATE',
                                parent_component_id: null
                            },
                            {
                                id: 'privacy-version',
                                codename: 'PrivacyVersion',
                                column_name: 'privacy_version',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'privacy-accepted-at',
                                codename: 'PrivacyAcceptedAt',
                                column_name: 'privacy_accepted_at',
                                data_type: 'DATE',
                                parent_component_id: null
                            },
                            { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_component_id: null },
                            {
                                id: 'attr-3',
                                codename: 'GuestSessionToken',
                                column_name: 'guest_session_token',
                                data_type: 'STRING',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        accessLinkQueryScopes.push(String(params[1] ?? ''))
                        return currentWorkspaceId === workspaceId1 || currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: contentNodeId,
                                      is_active: true,
                                      max_uses: 5,
                                      use_count: 0
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`UPDATE "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2 ? [{ id: accessLinkId }] : []
                    }

                    if (sql.includes(`INSERT INTO "${schemaName}"."students_table"`)) {
                        return [{ id: String(params[0]) }]
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const outerTransaction = dataSource.transaction.getMockImplementation()
        if (!outerTransaction) {
            throw new Error('Expected the public runtime test executor to expose a transaction implementation')
        }

        let releaseCommit: (() => void) | undefined
        const commitBarrier = new Promise<void>((resolve) => {
            releaseCommit = resolve
        })
        let resolveCallbackFinished: (() => void) | undefined
        const callbackFinished = new Promise<void>((resolve) => {
            resolveCallbackFinished = resolve
        })
        let transactionCommitted = false
        dataSource.transaction.mockImplementation(async (callback) => {
            const result = await outerTransaction(callback)
            resolveCallbackFinished?.()
            await commitBarrier
            transactionCommitted = true
            return result
        })

        const app = buildApp(dataSource)
        let responseResolved = false
        const responsePromise = request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .set('Idempotency-Key', guestIdempotencyKey)
            .send({
                firstName: 'Guest',
                lastName: 'Learner',
                accessLinkId,
                workspaceId: workspaceId2,
                termsAccepted: true,
                privacyAccepted: true
            })
            .expect(201)
            .then((response) => {
                responseResolved = true
                return response
            })

        await callbackFinished
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(responseResolved).toBe(false)

        releaseCommit?.()
        const response = await responsePromise
        expect(transactionCommitted).toBe(true)

        const decodedToken = JSON.parse(Buffer.from(response.body.sessionToken, 'base64url').toString('utf8'))
        expect(decodedToken.workspaceId).toBe(workspaceId2)
        expect(accessLinkQueryScopes.length).toBeGreaterThan(1)
        expect(accessLinkQueryScopes.every((scope) => scope === workspaceId2)).toBe(true)
    })
})
