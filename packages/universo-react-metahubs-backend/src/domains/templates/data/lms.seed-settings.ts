export const LMS_PUBLIC_GUEST_RUNTIME_CONFIG = {
    objects: {
        accessLinks: 'AccessLinks',
        participants: 'Students',
        assessments: 'Quizzes',
        contentNodes: 'LearningResources',
        assessmentResponses: 'QuizResponses',
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
            classId: 'LinkClassId'
        },
        participant: {
            displayName: 'DisplayName',
            isGuest: 'IsGuest',
            guestSessionToken: 'GuestSessionToken'
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
            questionId: 'QuestionId',
            selectedOptionIds: 'SelectedOptionIds',
            isCorrect: 'IsCorrect',
            attemptNumber: 'AttemptNumber',
            submittedAt: 'SubmittedAt'
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
