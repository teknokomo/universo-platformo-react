import { Init1693891895163 } from './1693891895163-Init'
import { ModifyChatFlow1693995626941 } from './1693995626941-ModifyChatFlow'
import { ModifyChatMessage1693996694528 } from './1693996694528-ModifyChatMessage'
import { ModifyCredential1693997070000 } from './1693997070000-ModifyCredential'
import { ModifyTool1693997339912 } from './1693997339912-ModifyTool'
import { AddApiConfig1694099183389 } from './1694099183389-AddApiConfig'
import { AddAnalytic1694432361423 } from './1694432361423-AddAnalytic'
import { AddChatHistory1694658756136 } from './1694658756136-AddChatHistory'
import { AddAssistantEntity1699325775451 } from './1699325775451-AddAssistantEntity'
import { AddUsedToolsToChatMessage1699481607341 } from './1699481607341-AddUsedToolsToChatMessage'
import { AddCategoryToChatFlow1699900910291 } from './1699900910291-AddCategoryToChatFlow'
import { AddFileAnnotationsToChatMessage1700271021237 } from './1700271021237-AddFileAnnotationsToChatMessage'
import { AddFileUploadsToChatMessage1701788586491 } from './1701788586491-AddFileUploadsToChatMessage'
import { AddVariableEntity1699325775451 } from './1702200925471-AddVariableEntity'
import { AddSpeechToText1706364937060 } from './1706364937060-AddSpeechToText'
import { AddFeedback1707213601923 } from './1707213601923-AddFeedback'
import { AddUpsertHistoryEntity1709814301358 } from './1709814301358-AddUpsertHistoryEntity'
import { FieldTypes1710497452584 } from './1710497452584-FieldTypes'
import { AddLead1710832137905 } from './1710832137905-AddLead'
import { AddLeadToChatMessage1711538016098 } from './1711538016098-AddLeadToChatMessage'
import { AddVectorStoreConfigToDocStore1715861032479 } from './1715861032479-AddVectorStoreConfigToDocStore'
import { AddDocumentStore1711637331047 } from './1711637331047-AddDocumentStore'
import { AddAgentReasoningToChatMessage1714679514451 } from './1714679514451-AddAgentReasoningToChatMessage'
import { AddTypeToChatFlow1716300000000 } from './1716300000000-AddTypeToChatFlow'
import { AddApiKey1720230151480 } from './1720230151480-AddApiKey'
import { AddActionToChatMessage1721078251523 } from './1721078251523-AddActionToChatMessage'
import { AddCustomTemplate1725629836652 } from './1725629836652-AddCustomTemplate'
import { AddArtifactsToChatMessage1726156258465 } from './1726156258465-AddArtifactsToChatMessage'
import { AddFollowUpPrompts1726666309552 } from './1726666309552-AddFollowUpPrompts'
import { AddTypeToAssistant1733011290987 } from './1733011290987-AddTypeToAssistant'
import { AddUniks1741277504476 } from './1741277504476-AddUniks'
import { AddEvaluation1714548873039 } from './1714548873039-AddEvaluation'
import { AddDatasets1714548903384 } from './1714548903384-AddDataset'
import { AddEvaluator1714808591644 } from './1714808591644-AddEvaluator'
import { AddSeqNoToDatasetRow1733752119696 } from './1733752119696-AddSeqNoToDatasetRow'
import { AddExecutionEntity1738090872625 } from './1738090872625-AddExecutionEntity'
import { FixOpenSourceAssistantTable1743758056188 } from './1743758056188-FixOpenSourceAssistantTable'
import { AddErrorToEvaluationRun1744964560174 } from './1744964560174-AddErrorToEvaluationRun'
import { ModifyExecutionSessionIdFieldType1748450230238 } from './1748450230238-ModifyExecutionSessionIdFieldType'

export const postgresMigrations = [
    Init1693891895163,
    ModifyChatFlow1693995626941,
    ModifyChatMessage1693996694528,
    ModifyCredential1693997070000,
    ModifyTool1693997339912,
    AddApiConfig1694099183389,
    AddAnalytic1694432361423,
    AddChatHistory1694658756136,
    AddAssistantEntity1699325775451,
    AddUsedToolsToChatMessage1699481607341,
    AddCategoryToChatFlow1699900910291,
    AddFileAnnotationsToChatMessage1700271021237,
    AddVariableEntity1699325775451,
    AddFileUploadsToChatMessage1701788586491,
    AddSpeechToText1706364937060,
    AddUpsertHistoryEntity1709814301358,
    AddFeedback1707213601923,
    FieldTypes1710497452584,
    AddDocumentStore1711637331047,
    AddLead1710832137905,
    AddLeadToChatMessage1711538016098,
    AddAgentReasoningToChatMessage1714679514451,
    AddTypeToChatFlow1716300000000,
    AddVectorStoreConfigToDocStore1715861032479,
    AddApiKey1720230151480,
    AddActionToChatMessage1721078251523,
    AddCustomTemplate1725629836652,
    AddArtifactsToChatMessage1726156258465,
    AddFollowUpPrompts1726666309552,
    AddTypeToAssistant1733011290987,
    AddUniks1741277504476,
    AddEvaluation1714548873039,
    AddDatasets1714548903384,
    AddEvaluator1714808591644,
    AddSeqNoToDatasetRow1733752119696,
    AddExecutionEntity1738090872625,
    FixOpenSourceAssistantTable1743758056188,
    AddErrorToEvaluationRun1744964560174,
    ModifyExecutionSessionIdFieldType1748450230238
]
