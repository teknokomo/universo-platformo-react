export const LMS_PUBLIC_GUEST_RUNTIME_CONFIG = {
    objects: {
        accessLinks: 'AccessLinks',
        participants: 'Students',
        assessments: 'Quizzes',
        contentNodes: 'LearningResources',
        assessmentResponses: 'QuizResponses',
        assessmentAttempts: 'QuizAttempts',
        contentProgress: 'ContentProgress'
    },
    fields: {
        accessLink: {
            slug: 'Slug',
            targetType: 'TargetType',
            targetId: 'TargetId',
            contentNodeIdRef: 'ContentNodeIdRef',
            isActive: 'IsActive',
            expiresAt: 'ExpiresAt',
            maxUses: 'MaxUses',
            useCount: 'UseCount',
            title: 'LinkTitle',
            classId: 'LinkClassId',
            showFirstName: 'ShowFirstName',
            requireFirstName: 'RequireFirstName',
            showLastName: 'ShowLastName',
            requireLastName: 'RequireLastName',
            showEmail: 'ShowEmail',
            requireEmail: 'RequireEmail',
            showPhone: 'ShowPhone',
            requirePhone: 'RequirePhone',
            captchaEnabled: 'CaptchaEnabled'
        },
        participant: {
            displayName: 'DisplayName',
            firstName: 'FirstName',
            lastName: 'LastName',
            email: 'Email',
            phone: 'Phone',
            isGuest: 'IsGuest',
            guestSessionToken: 'GuestSessionToken',
            termsVersion: 'TermsVersion',
            termsAcceptedAt: 'TermsAcceptedAt',
            privacyVersion: 'PrivacyVersion',
            privacyAcceptedAt: 'PrivacyAcceptedAt'
        },
        contentNode: {
            title: 'Title',
            description: 'Description',
            contentItems: 'ContentItems'
        },
        contentPart: {
            itemType: 'ItemType',
            itemTitle: 'ItemTitle',
            itemContent: 'ItemContent',
            quizId: 'QuizId',
            sortOrder: 'SortOrder'
        },
        assessment: {
            title: 'Title',
            description: 'Description',
            passingScorePercent: 'PassingScorePercent',
            maxAttempts: 'MaxAttempts',
            timeLimitSeconds: 'TimeLimitSeconds',
            completionText: 'CompletionText',
            questions: 'Questions'
        },
        assessmentQuestion: {
            prompt: 'Prompt',
            description: 'QuestionDescription',
            questionType: 'QuestionType',
            explanation: 'Explanation',
            sortOrder: 'SortOrder',
            options: 'Options'
        },
        assessmentResponse: {
            studentId: 'StudentId',
            quizId: 'QuizId',
            attemptId: 'AttemptId',
            questionId: 'QuestionId',
            selectedOptionIds: 'SelectedOptionIds',
            isCorrect: 'IsCorrect',
            attemptNumber: 'AttemptNumber',
            submittedAt: 'SubmittedAt'
        },
        assessmentAttempt: {
            studentId: 'StudentId',
            quizId: 'QuizId',
            attemptNumber: 'AttemptNumber',
            startedAt: 'StartedAt',
            submittedAt: 'SubmittedAt',
            deadlineAt: 'DeadlineAt',
            effectiveTimeLimitSeconds: 'EffectiveTimeLimitSeconds',
            passingScorePercentSnapshot: 'PassingScorePercentSnapshot',
            finishedReason: 'FinishedReason',
            questionsSnapshot: 'QuestionsSnapshot',
            questionSetDigest: 'QuestionSetDigest',
            accessLinkId: 'AccessLinkId',
            score: 'Score',
            totalQuestions: 'TotalQuestions',
            passed: 'Passed',
            status: 'Status'
        },
        contentProgress: {
            studentId: 'ProgressStudentId',
            contentNodeId: 'ContentNodeId',
            status: 'ProgressStatus',
            progressPercent: 'ProgressPercent',
            startedAt: 'StartedAt',
            completedAt: 'CompletedAt',
            lastAccessedItemIndex: 'LastAccessedItemIndex'
        }
    }
} as const
