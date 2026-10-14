import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source.json')
const data = JSON.parse(await readFile(dataPath, 'utf8'))
const algorithmVersion = 'lyceum-marathon-balanced-positions-v1'
const expectedGrades = [5, 6, 7, 8, 9, 10, 11]
const expectedSourceMetadata = new Map([
    [
        5,
        {
            sourceFile: 'Интеллектуальный-марафон-5-класс.txt',
            sourceSha256: '1432510be557c9dedb571ef45c6b7d44f220bd4ec8146fd2f86898b843dd722f'
        }
    ],
    [
        6,
        {
            sourceFile: 'Интеллектуальный-марафон-6-класс.txt',
            sourceSha256: 'fe52a41a22df42ab058b9acc296a55e159606ea9d63c4386f98885e18adaddd6'
        }
    ],
    [
        7,
        {
            sourceFile: 'Интеллектуальный-марафон-7-класс.txt',
            sourceSha256: '564bce0b6ee210b226c168959099c7d6ab9f802a81e6793deb5ba45b0dd9e5dd'
        }
    ],
    [
        8,
        {
            sourceFile: 'Интеллектуальный-марафон-8-класс.txt',
            sourceSha256: 'aeb9350e42ce59e7fac4d2741c31dc28ca03be002c8ec2ba851c605f0f08c589'
        }
    ],
    [
        9,
        {
            sourceFile: 'Интеллектуальный-марафон-9-класс.txt',
            sourceSha256: '8f16e094abcbb4d43c83165447233977b15216de4617630a741583519553f2d0'
        }
    ],
    [
        10,
        {
            sourceFile: 'Интеллектуальный-марафон-10-класс.txt',
            sourceSha256: '38ed471be69ec7a63ebb1984d8960433bc041580b3f60757e505ad242a502e1d'
        }
    ],
    [
        11,
        {
            sourceFile: 'Интеллектуальный-марафон-11-класс.txt',
            sourceSha256: '857ebcdf7ac7281519e6d7bc32744ac0395b1684e5896641f852603885b4e9cc'
        }
    ]
])
const allowedPromptCorrections = new Map([
    ['lm-g11-q06', 'Какой год в фольклоре связывают с новым началом в отношениях, когда женщина может сделать предложение мужчине?'],
    ['lm-g05-q06', 'В какой современной стране находится город Терни, связанный с почитанием святого Валентина?'],
    ['lm-g05-q22', 'Какие четыре царства выделяют в традиционной школьной классификации живых организмов?'],
    ['lm-g06-q03', 'Ягода какого из перечисленных растений считается самой крупной?'],
    ['lm-g06-q02', 'Какому персонажу трагедии Уильяма Шекспира «Юлий Цезарь» принадлежит реплика «И ты, Брут»?'],
    ['lm-g06-q04', 'Лист какого растения, плавающего на воде, может выдержать вес трёхлетнего ребёнка?'],
    ['lm-g06-q27', 'Какое значение имеет неопределённый артикль a/an перед исчисляемым существительным в единственном числе?'],
    ['lm-g06-q29', 'Какую зону дистанции в модели проксемики Э. Холла обычно связывают с общением со знакомыми?'],
    ['lm-g05-q29', 'Сезонные изменения в природе, за которыми наблюдает человек, называются (...)'],
    ['lm-g06-q17', 'Какие частицы образуют ядро атома?'],
    ['lm-g07-q12', 'Как называются две непересекающиеся прямые в одной плоскости?'],
    ['lm-g07-q18', 'С какого возраста в России по общему правилу наступает уголовная ответственность?'],
    ['lm-g07-q21', 'В каких единицах выражают общие коэффициенты рождаемости и смертности населения?'],
    ['lm-g07-q29', 'В каком году состоялись XIX зимние Олимпийские игры?'],
    ['lm-g07-q28', 'Назовите стиль в архитектуре эпохи Возрождения.'],
    ['lm-g08-q13', 'В каком возрастном диапазоне несовершеннолетние обладают частичной дееспособностью по статье 26 ГК РФ?'],
    ['lm-g08-q16', 'Какая этническая группа является самой многочисленной в Китае?'],
    ['lm-g08-q17', 'Как называется пролив у берегов Великобритании, через который проходят торговые пути между Европой и остальным миром?'],
    ['lm-g08-q27', 'Какой химический элемент наиболее распространён в земной коре?'],
    ['lm-g09-q06', 'В треугольнике стороны равны 3; 4; 5. Какой это треугольник по величине углов?'],
    ['lm-g10-q03', 'Кому приписывают слова: «Фельдмаршала на солдат не меняю»?'],
    ['lm-g10-q06', 'Кому А. С. Пушкин посвятил стихотворение «Я помню чудное мгновенье…»?'],
    ['lm-g09-q07', 'В какой войне участвовал крейсер «Варяг», экипаж которого затопил корабль после боя?'],
    ['lm-g09-q21', 'Верно ли, что снег, отражая солнечный свет, греет Землю?'],
    ['lm-g09-q22', 'Кого считают первым естествоиспытателем Нового времени?'],
    ['lm-g09-q24', 'Какие химические реакции сопровождаются выделением теплоты?'],
    ['lm-g10-q14', 'Кипит ли вода в трубах магистрали централизованного теплоснабжения при штатном давлении?'],
    ['lm-g10-q15', 'Какое физическое явление объясняет, почему предметы продолжают движение при землетрясении?'],
    ['lm-g10-q20', 'Кто является основоположником современных Олимпийских игр? Где и когда состоялась первая Олимпиада?'],
    [
        'lm-g10-q30',
        'Назовите американского писателя, получившего в 1954 году Нобелевскую премию по литературе. Какое его произведение упоминается в формулировке премии?'
    ],
    ['lm-g11-q10', 'В результате какого события древние скифы оказывались в погребальных камерах курганов, а живые покидали свои дома?'],
    [
        'lm-g11-q16',
        'В какой стране находится финансовый центр, который Luxembourg for Finance характеризует как панъевропейский банковский центр с глобальным охватом?'
    ],
    ['lm-g11-q23', 'Что передал А. С. Попов в радиограмме 1896 года?'],
    ['lm-g11-q25', 'Какой термодинамический процесс участвует в образовании облаков?'],
    ['lm-g11-q29', 'Как называют белые пигменты, которые добавляют в бумажную массу для повышения её белизны?']
])
const allowedAnswerCorrections = new Map([
    ['lm-g06-q01', 'Аграрное общество'],
    ['lm-g06-q02', 'Юлию Цезарю'],
    ['lm-g06-q04', 'Виктория амазонская (гигантская кувшинка)'],
    ['lm-g06-q09', 'Когда делитель = 1'],
    ['lm-g06-q13', 'Остров Атласова'],
    ['lm-g06-q14', 'В честь Невельского'],
    ['lm-g06-q18', '776 г до н. э.'],
    ['lm-g06-q22', 'Н. А. Некрасов'],
    ['lm-g06-q23', 'Потому что это обозначение беспородной собаки'],
    [
        'lm-g06-q26',
        'Международный проект Сергея Дягилева по представлению русского искусства; знаменитый балетный сезон начался в 1909 году'
    ],
    ['lm-g06-q29', 'Социальная зона: 1,2–3,7 м'],
    ['lm-g07-q03', 'Иван Пущин'],
    ['lm-g07-q11', '48 см²'],
    ['lm-g07-q18', 'С 16 лет'],
    ['lm-g07-q20', 'Около 21 июня'],
    ['lm-g07-q22', 'Мёртвое море'],
    ['lm-g07-q25', 'Анион'],
    ['lm-g07-q28', 'Ренессанс'],
    ['lm-g07-q30', 'Лёгкая атлетика'],
    ['lm-g08-q01', '—тек(а), означающее «ящик, хранилище»'],
    ['lm-g08-q03', 'Тайну Эдвина Друда'],
    ['lm-g08-q08', '180°⋅(n−2)'],
    ['lm-g08-q16', 'Ханьцы'],
    ['lm-g08-q18', '206'],
    ['lm-g08-q23', 'Эрнест Резерфорд'],
    ['lm-g09-q03', 'Иван Александрович'],
    ['lm-g09-q06', 'Прямоугольный'],
    ['lm-g09-q08', '{–5, 5}'],
    ['lm-g09-q14', '180°'],
    ['lm-g09-q20', 'Острова Сахалин, Тюлений и Монерон, Большая и Малая Курильские гряды'],
    ['lm-g10-q01', 'Потому что имя Ярослава Мудрого в крещении — Георгий'],
    ['lm-g10-q03', 'Сталину'],
    ['lm-g10-q05', '«Ганц Кюхельгартен»'],
    ['lm-g10-q19', '23-я пара хромосом'],
    ['lm-g10-q20', 'Пьер де Кубертен; Афины; 1896 год'],
    ['lm-g10-q22', 'Нет'],
    ['lm-g10-q26', '1 часть азотной + 3 части соляной'],
    ['lm-g10-q28', 'Рутений и самарий'],
    ['lm-g11-q07', 'y - y0 = f’(x0)(x - x0)'],
    ['lm-g11-q08', 'x = 2'],
    ['lm-g11-q09', '1918 — перешли на новое летоисчисление'],
    ['lm-g11-q25', 'Адиабатическое расширение воздуха'],
    ['lm-g11-q28', 'И. П. Мартос']
])
// Q11/6 and Q11/10 now have evidence-backed, unambiguous prompts. Q10/3 asks
// specifically about the source's attribution, not whether the disputed quote is authentic.
const requiredReviewNoteQuestionIds = new Set(['lm-g10-q03'])
const requiredAnswerEvidenceRefs = new Map([
    ['lm-g06-q01', 'https://www.sciencedirect.com/topics/agricultural-and-biological-sciences/agrarian-society'],
    ['lm-g06-q04', 'https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:605776-1/general-information'],
    ['lm-g06-q26', 'https://www.vam.ac.uk/articles/diaghilev-and-the-ballets-russes'],
    ['lm-g07-q18', 'https://www.consultant.ru/document/cons_doc_LAW_10699/fd969cc22a68d513db2c83a94d6ad355a95dbec7/'],
    ['lm-g07-q20', 'https://science.nasa.gov/solar-system/skywatching/night-sky-network/tropical-solstice-shadows/'],
    ['lm-g07-q28', 'https://expo.bib.kuleuven.be/exhibits/show/renaissance-architecture/renaissance-architect'],
    ['lm-g09-q03', 'https://rvb.ru/gogol/01text/vol_04/03_edit/0096.htm'],
    ['lm-g08-q18', 'https://www.ncbi.nlm.nih.gov/books/NBK441968/'],
    ['lm-g10-q20', 'https://library.olympics.com/Default/Portal/basicfilesdownload.ashx?itemGuid=2ECE9BE9-EA5F-4F0F-97DF-84C75B6BC60A'],
    ['lm-g11-q25', 'https://prod-01-alb-www-noaa.woc.noaa.gov/jetstream/clouds/how-clouds-form'],
    ['lm-g06-q29', 'https://link.springer.com/article/10.1007/s10055-024-00982-5']
])
const requiredPromptEvidenceRefs = new Map([
    ['lm-g05-q06', 'https://www.vaticannews.va/en/saints/02/14/st--valentin--martyr-on-the--via-flaminia.html'],
    ['lm-g06-q29', 'https://link.springer.com/article/10.1007/s10055-024-00982-5'],
    [
        'lm-g09-q24',
        'https://chem.libretexts.org/Courses/Chandler_Gilbert_Community_College/Fundamental_Organic_ala_Mech/05%3A_Unit_2/5.02%3A_Reactions_overview/5.2.07%3A_Describing_a_Reaction_-_Equilibria__Rates_and_Energy_Changes'
    ],
    ['lm-g11-q16', 'https://www.luxembourgforfinance.com/en/financial-centre/banking/'],
    ['lm-g11-q06', 'https://folklife.si.edu/magazine/leap-day-origins-lore'],
    [
        'lm-g11-q10',
        'https://www.thebritishacademy.ac.uk/publishing/journal-british-academy/5/burial-mounds-scythian-elites-eurasian-steppe-new-discoveries/'
    ],
    ['lm-g06-q02', 'https://www.folger.edu/explore/shakespeares-works/julius-caesar/read/3/1/'],
    ['lm-g07-q21', 'https://unstats.un.org/unsd/demographic-social/products/dyb/dybsets/2022.pdf'],
    ['lm-g08-q16', 'https://www.stats.gov.cn/english/PressRelease/202105/t20210510_1817185.html']
])
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceDirectory = path.join(repositoryRoot, data.provenance.sourceDirectory)
const sourceFilesAvailable = await access(sourceDirectory).then(
    () => true,
    () => false
)
const expectedSourceTranscriptionDigest = 'e3564ef124cb4bc988cc8a96e4f59d9da4e3285c27c3b56feee600bdffe8fcfc'

const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const hashSourceBytes = (value) => createHash('sha256').update(value).digest('hex')
const cleanSourceText = (value) => value.replace(/\*\*/g, '').replace(/`/g, '').trim()
const normalizeChoice = (value) => value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

const sourceTranscriptionDigest = sha256(
    JSON.stringify(
        data.grades.map(({ grade, questions }) => ({
            grade,
            questions: questions.map((question) => ({
                number: question.number,
                openAnswerBlock: question.source?.openAnswerBlock,
                preparedMultipleChoiceBlock: question.source?.preparedMultipleChoiceBlock
            }))
        }))
    )
)
assert.equal(sourceTranscriptionDigest, expectedSourceTranscriptionDigest, 'The approved source transcription has changed')

const readOpenAnswerBlock = (text, grade) => {
    const firstSection = text.split(/^---\s*$/m, 1)[0]
    const lines = firstSection.split(/\r?\n/)
    const questions = []

    for (let index = 0; index < lines.length; index += 1) {
        const questionMatch = lines[index].match(/^\s*(\d+)\.\s*(.*?)\s*$/)
        if (!questionMatch) continue

        let answerIndex = index + 1
        while (answerIndex < lines.length && !lines[answerIndex].trim()) answerIndex += 1
        const answerMatch = lines[answerIndex]?.match(/^\s*[—–-]\s*(.*?)\s*$/)
        assert.ok(answerMatch, `Grade ${grade}, question ${questionMatch[1]} has no first-block answer line`)

        questions.push({
            number: Number(questionMatch[1]),
            prompt: cleanSourceText(questionMatch[2]),
            answer: cleanSourceText(answerMatch[1])
        })
    }

    return questions
}

const readPreparedMultipleChoiceBlock = (text, grade) => {
    const lines = text.split(/\r?\n/)
    const separatorIndex = lines.findIndex((line) => /^---\s*$/.test(line))
    assert.notEqual(separatorIndex, -1, `Grade ${grade} source has no multiple-choice section`)

    const questions = []
    let currentQuestion = null
    const finishQuestion = () => {
        if (!currentQuestion) return
        questions.push(currentQuestion)
        currentQuestion = null
    }

    for (const line of lines.slice(separatorIndex + 1)) {
        const questionMatch = line.match(/^\s*(\d+)\.\s*(.*?)\s*$/)
        if (questionMatch) {
            finishQuestion()
            currentQuestion = {
                number: Number(questionMatch[1]),
                prompt: cleanSourceText(questionMatch[2]),
                options: []
            }
            continue
        }

        const optionMatch = line.match(/^\s*-\s*(.*?)\s*$/)
        if (!optionMatch || !currentQuestion) continue
        const rawOption = optionMatch[1]
        const markedCorrectInSource = /✅\s*$/.test(rawOption)
        currentQuestion.options.push({
            text: cleanSourceText(rawOption.replace(/\s*✅\s*$/, '')),
            markedCorrectInSource
        })
    }

    finishQuestion()
    return questions
}

assert.equal(data.datasetId, 'lyceum-intellectual-marathon')
assert.equal(data.language, 'ru')
assert.match(data.contentApproval, /source answer key remains provisional/i)
assert.match(data.contentApproval, /content-owner confirmation/i)
assert.equal(data.provenance.sourceQuestionCount, 210)
assert.deepEqual(
    data.grades.map(({ grade }) => grade),
    expectedGrades
)
assert.equal(data.correctPositionAlgorithm.version, algorithmVersion)

const allQuestionIds = new Set()
const allOptionIds = new Set()
const flattenedEdits = []
const changedPromptIds = new Set()
const changedAnswerIds = new Set()
const reviewNoteQuestionIds = new Set()
let totalQuestions = 0
let totalReviewNotes = 0

for (const gradeData of data.grades) {
    const { grade, sourceFile, sourceSha256, questions } = gradeData
    const expectedSource = expectedSourceMetadata.get(grade)
    assert.ok(expectedSource, `Grade ${grade} must have approved source metadata`)
    assert.equal(sourceFile, expectedSource.sourceFile, `Grade ${grade} source filename has changed`)
    assert.equal(sourceSha256, expectedSource.sourceSha256, `Grade ${grade} source SHA-256 has changed`)
    assert.match(sourceFile, /^Интеллектуальный-марафон-\d+-класс\.txt$/)
    assert.match(sourceSha256, /^[a-f0-9]{64}$/)
    assert.equal(questions.length, 30, `Grade ${grade} must have exactly 30 questions`)

    const sourceBytes = sourceFilesAvailable ? await readFile(path.join(sourceDirectory, sourceFile)) : null
    if (sourceBytes) {
        assert.equal(hashSourceBytes(sourceBytes), gradeData.sourceSha256, `Grade ${grade} source hash has changed`)
    }
    const storedOpenQuestions = questions.map((question) => ({
        number: question.number,
        prompt: question.source?.openAnswerBlock?.prompt,
        answer: question.source?.openAnswerBlock?.answer
    }))
    const storedPreparedQuestions = questions.map((question) => ({
        number: question.number,
        prompt: question.source?.preparedMultipleChoiceBlock?.prompt,
        options: question.source?.preparedMultipleChoiceBlock?.options
    }))
    const parsedSourceQuestions = sourceBytes ? readOpenAnswerBlock(sourceBytes.toString('utf8'), grade) : storedOpenQuestions
    assert.equal(parsedSourceQuestions.length, 30, `Grade ${grade} source must contain 30 first-block questions`)
    const parsedSourceChoices = sourceBytes ? readPreparedMultipleChoiceBlock(sourceBytes.toString('utf8'), grade) : storedPreparedQuestions
    assert.equal(parsedSourceChoices.length, 30, `Grade ${grade} source must contain 30 prepared MC questions`)

    const rankedQuestions = [...questions].sort((left, right) => {
        const leftHash = sha256(`${algorithmVersion}/grade-${grade}/${left.id}`)
        const rightHash = sha256(`${algorithmVersion}/grade-${grade}/${right.id}`)
        return leftHash.localeCompare(rightHash) || left.id.localeCompare(right.id)
    })
    const rankById = new Map(rankedQuestions.map((question, index) => [question.id, index]))
    const offset = Number.parseInt(sha256(`${algorithmVersion}/grade-${grade}/offset`).slice(0, 8), 16) % 4
    const positionCounts = [0, 0, 0, 0]

    for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index]
        const expectedId = `lm-g${String(grade).padStart(2, '0')}-q${String(index + 1).padStart(2, '0')}`
        assert.equal(question.id, expectedId, `Unexpected question ID at grade ${grade}, question ${index + 1}`)
        assert.equal(question.grade, grade)
        assert.equal(question.number, index + 1)
        assert.equal(question.language, 'ru')
        assert.ok(question.prompt.trim(), `${question.id} has an empty prompt`)
        assert.ok(question.answer.trim(), `${question.id} has an empty answer`)
        assert.ok(!allQuestionIds.has(question.id), `Duplicate question ID: ${question.id}`)
        allQuestionIds.add(question.id)

        const sourceOpen = question.source?.openAnswerBlock
        const sourceMc = question.source?.preparedMultipleChoiceBlock
        const parsedSource = parsedSourceQuestions[index]
        const parsedMc = parsedSourceChoices[index]
        assert.equal(parsedSource.number, question.number, `${question.id} changed source order`)
        assert.deepEqual(
            sourceOpen,
            { prompt: parsedSource.prompt, answer: parsedSource.answer },
            `${question.id} source transcription must match the first block exactly`
        )
        assert.ok(sourceOpen?.prompt?.trim(), `${question.id} is missing its first-block prompt`)
        assert.ok(sourceOpen?.answer?.trim(), `${question.id} is missing its first-block answer`)
        assert.equal(sourceMc?.authority, 'candidate-distractors-only')
        assert.equal(parsedMc.number, question.number, `${question.id} changed prepared-MC source order`)
        assert.equal(sourceMc.prompt, parsedMc.prompt, `${question.id} MC prompt provenance must match the source file`)
        assert.deepEqual(sourceMc.options, parsedMc.options, `${question.id} MC option provenance must match the source file`)
        assert.equal(parsedMc.options.length, 4, `${question.id} source MC must contain four options`)
        assert.equal(sourceMc.options.filter((option) => option.markedCorrectInSource).length, 1)

        const editFields = new Set()
        for (const edit of question.edits) {
            assert.ok(edit.field && edit.reason?.trim(), `${question.id} contains an incomplete edit record`)
            assert.ok(!editFields.has(edit.field), `${question.id} has duplicate edit records for ${edit.field}`)
            editFields.add(edit.field)

            if (edit.field === 'prompt') {
                assert.equal(edit.before, sourceOpen.prompt, `${question.id} prompt edit must start from the first block`)
                assert.equal(edit.after, question.prompt, `${question.id} prompt edit must match the canonical prompt`)
            } else if (edit.field === 'answerKey') {
                assert.equal(edit.before, sourceOpen.answer, `${question.id} key edit must start from the authoritative first-block answer`)
                assert.equal(edit.after, question.answer, `${question.id} key edit must match the canonical answer`)
            } else {
                const optionMatch = edit.field.match(/^options\[([1-4])\]$/)
                assert.ok(optionMatch, `${question.id} has an unsupported edit field: ${edit.field}`)
                const sourceIndex = Number(optionMatch[1]) - 1
                const canonicalOption = question.options.find((option) => option.sourceNumber === sourceIndex + 1)
                assert.ok(canonicalOption, `${question.id} is missing source option ${sourceIndex + 1}`)
                assert.equal(edit.before, sourceMc.options[sourceIndex].text, `${question.id} option edit must match its prepared source`)
                assert.equal(edit.after, canonicalOption.text, `${question.id} option edit must match the canonical option`)
            }
        }

        const promptEdit = question.edits.find((edit) => edit.field === 'prompt')
        if (promptEdit) {
            changedPromptIds.add(question.id)
            assert.equal(promptEdit.before, sourceOpen.prompt, `${question.id} prompt edit must start from the first block`)
            assert.equal(promptEdit.after, question.prompt, `${question.id} prompt edit must match the canonical prompt`)
            assert.equal(
                allowedPromptCorrections.get(question.id),
                question.prompt,
                `${question.id} prompt change is not an approved minimal correction`
            )
            const requiredPromptEvidenceRef = requiredPromptEvidenceRefs.get(question.id)
            if (requiredPromptEvidenceRef) {
                assert.equal(
                    promptEdit.evidenceRef,
                    requiredPromptEvidenceRef,
                    `${question.id} prompt correction must cite ${requiredPromptEvidenceRef}`
                )
            }
        } else {
            assert.equal(question.prompt, sourceOpen.prompt, `${question.id} changed its prompt without a log entry`)
            assert.equal(allowedPromptCorrections.has(question.id), false, `${question.id} is missing its approved prompt correction`)
        }

        assert.equal(question.options.length, 4, `${question.id} must have exactly four choices`)
        assert.ok(Array.isArray(question.reviewNotes), `${question.id} must declare reviewNotes`)
        assert.ok(
            question.reviewNotes.every((note) => typeof note === 'string' && note.trim()),
            `${question.id} has an empty review note`
        )
        if (question.reviewNotes.length > 0) reviewNoteQuestionIds.add(question.id)
        if (requiredReviewNoteQuestionIds.has(question.id)) {
            assert.equal(question.reviewNotes.length, 1, `${question.id} must retain exactly one owner-review note`)
        } else {
            assert.equal(question.reviewNotes.length, 0, `${question.id} has an unexpected owner-review note`)
        }
        assert.equal(question.options.filter((option) => option.isCorrect).length, 1, `${question.id} must have exactly one correct choice`)
        const normalizedChoices = question.options.map((option) => normalizeChoice(option.text))
        assert.ok(normalizedChoices.every(Boolean), `${question.id} has an empty choice`)
        assert.equal(new Set(normalizedChoices).size, 4, `${question.id} has duplicate choices`)
        const correctOption = question.options.find((option) => option.isCorrect)
        assert.equal(question.answer, correctOption.text, `${question.id} answer must equal its sole correct choice`)

        const answerKeyEdit = question.edits.find((edit) => edit.field === 'answerKey')
        if (question.answer !== sourceOpen.answer) {
            changedAnswerIds.add(question.id)
            assert.equal(
                allowedAnswerCorrections.get(question.id),
                question.answer,
                `${question.id} answer change is not an approved exact correction`
            )
            assert.ok(answerKeyEdit, `${question.id} changed the authoritative first-block answer without a change-log entry`)
            assert.equal(answerKeyEdit.before, sourceOpen.answer)
            assert.equal(answerKeyEdit.after, question.answer)
        } else {
            assert.equal(allowedAnswerCorrections.has(question.id), false, `${question.id} is missing its approved answer correction`)
            assert.equal(answerKeyEdit, undefined, `${question.id} has a stale answer-key edit despite retaining the first-block answer`)
        }

        const requiredEvidenceRef = requiredAnswerEvidenceRefs.get(question.id)
        if (requiredEvidenceRef) {
            assert.ok(answerKeyEdit, `${question.id} must record the evidence-supported answer-key correction`)
            assert.ok(answerKeyEdit.evidenceRef === requiredEvidenceRef, `${question.id} answer-key edit must cite ${requiredEvidenceRef}`)
            const correctChoiceEdit = question.edits.find((edit) => edit.field.startsWith('options[') && edit.after === question.answer)
            if (correctChoiceEdit) {
                assert.equal(
                    correctChoiceEdit.evidenceRef,
                    requiredEvidenceRef,
                    `${question.id} corrected right choice must cite its source`
                )
            }
        }

        for (const option of question.options) {
            assert.ok(Number.isInteger(option.sourceNumber) && option.sourceNumber >= 1 && option.sourceNumber <= 4)
            const sourceIndex = option.sourceNumber - 1
            const sourceOption = sourceMc.options[sourceIndex]
            if (option.text !== sourceOption.text) {
                assert.ok(
                    question.edits.some((edit) => edit.field === `options[${sourceIndex + 1}]`),
                    `${question.id} changed source option ${sourceIndex + 1} without a change-log entry`
                )
            }
        }

        const expectedSlot = (rankById.get(question.id) + offset) % 4
        assert.equal(question.correctPosition, expectedSlot + 1, `${question.id} correct position is not reproducible`)
        assert.equal(question.options[expectedSlot].isCorrect, true, `${question.id} correct option is in the wrong slot`)
        positionCounts[expectedSlot] += 1

        const sourceNumbers = question.options.map((option) => {
            assert.match(option.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
            assert.ok(!allOptionIds.has(option.id), `Duplicate option ID: ${option.id}`)
            allOptionIds.add(option.id)
            return option.sourceNumber
        })
        const distractorSourceNumbers = question.options.filter((option) => !option.isCorrect).map((option) => option.sourceNumber)
        assert.deepEqual(
            distractorSourceNumbers,
            [...distractorSourceNumbers].sort((a, b) => a - b),
            `${question.id} changed distractor order during key placement`
        )
        assert.equal(new Set(sourceNumbers).size, 4)

        for (const edit of question.edits) flattenedEdits.push({ grade, questionNumber: question.number, ...edit })
        totalReviewNotes += question.reviewNotes.length
        totalQuestions += 1
    }

    assert.equal(
        positionCounts.reduce((sum, count) => sum + count, 0),
        30
    )
    assert.ok(
        positionCounts.every((count) => count === 7 || count === 8),
        `Grade ${grade} positions are not balanced: ${positionCounts}`
    )
}

assert.equal(totalQuestions, 210)
assert.equal(allQuestionIds.size, 210)
assert.equal(allOptionIds.size, 840)
assert.deepEqual(
    [...reviewNoteQuestionIds].sort(),
    [...requiredReviewNoteQuestionIds].sort(),
    'Only the explicitly unresolved source questions may retain owner-review notes'
)
assert.equal(
    totalReviewNotes,
    requiredReviewNoteQuestionIds.size,
    'Each unresolved source question must have exactly one owner-review note'
)
assert.deepEqual(
    [...changedPromptIds].sort(),
    [...allowedPromptCorrections.keys()].sort(),
    'Only enumerated minimal prompt corrections may differ from the authoritative first block'
)
assert.deepEqual(
    [...changedAnswerIds].sort(),
    [...allowedAnswerCorrections.keys()].sort(),
    'Only enumerated exact answer corrections may differ from the authoritative first-block key'
)
assert.equal(changedPromptIds.size, 35, 'The fixture must contain exactly 35 approved prompt corrections')
assert.equal(changedAnswerIds.size, 43, 'The fixture must contain exactly 43 approved answer-key corrections')
assert.equal(flattenedEdits.length, 125, 'The fixture must contain exactly 125 logged editorial edits')
assert.equal(data.editorialEditRegister.length, 125, 'The aggregate editorial register must contain all 125 logged edits')
assert.deepEqual(data.editorialEditRegister, flattenedEdits, 'Aggregate change log must exactly match per-question edits')

const winterGames = data.grades.find(({ grade }) => grade === 7).questions[28]
assert.match(winterGames.prompt, /XIX зимние Олимпийские игры/i)
assert.equal(winterGames.answer, '2002')
assert.ok(
    !winterGames.options.some((option) => option.text.includes('2024')),
    'The unrelated 2024 summer-games question/key must not enter the canonical quiz'
)
assert.equal(winterGames.source.openAnswerBlock.prompt, 'В каком году состоялись 19 олимпийские игры?')
assert.equal(winterGames.source.openAnswerBlock.answer, '2002')
assert.equal(
    winterGames.edits.some((edit) => edit.field === 'answerKey'),
    false
)

const valentineQuestion = data.grades.find(({ grade }) => grade === 5).questions[5]
assert.equal(valentineQuestion.prompt, 'В какой современной стране находится город Терни, связанный с почитанием святого Валентина?')
assert.equal(valentineQuestion.answer, 'Италия')
assert.equal(valentineQuestion.reviewNotes.length, 0)

const restoredPushkinQuestion = data.grades.find(({ grade }) => grade === 10).questions[5]
assert.equal(restoredPushkinQuestion.prompt, 'Кому А. С. Пушкин посвятил стихотворение «Я помню чудное мгновенье…»?')
assert.equal(restoredPushkinQuestion.answer, 'Анне Керн')

const articleQuestion = data.grades.find(({ grade }) => grade === 6).questions[26]
assert.equal(
    articleQuestion.prompt,
    'Какое значение имеет неопределённый артикль a/an перед исчисляемым существительным в единственном числе?'
)
assert.equal(articleQuestion.answer, 'Один')

const paperQuestion = data.grades.find(({ grade }) => grade === 11).questions[28]
assert.equal(paperQuestion.prompt, 'Как называют белые пигменты, которые добавляют в бумажную массу для повышения её белизны?')
assert.equal(paperQuestion.answer, 'Белила')
assert.equal(paperQuestion.source.openAnswerBlock.answer, 'Белила')
assert.equal(paperQuestion.options.find((option) => option.isCorrect)?.text, 'Белила')
assert.deepEqual(
    paperQuestion.edits.map((edit) => edit.field),
    ['prompt', 'options[1]'],
    'The grade 11 paper question must clarify the source wording while preserving its first-block key'
)
assert.equal(paperQuestion.reviewNotes.length, 0)

const shakespeareLineQuestion = data.grades.find(({ grade }) => grade === 6).questions[1]
assert.equal(shakespeareLineQuestion.prompt, 'Какому персонажу трагедии Уильяма Шекспира «Юлий Цезарь» принадлежит реплика «И ты, Брут»?')
assert.equal(shakespeareLineQuestion.answer, 'Юлию Цезарю')
assert.equal(shakespeareLineQuestion.source.openAnswerBlock.prompt, 'Кому принадлежат слова "И ты, Брут"?')
assert.equal(shakespeareLineQuestion.source.openAnswerBlock.answer, 'Юлий Цезарь')
assert.equal(
    shakespeareLineQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef,
    requiredPromptEvidenceRefs.get(shakespeareLineQuestion.id)
)

const demographicRatesQuestion = data.grades.find(({ grade }) => grade === 7).questions[20]
assert.equal(demographicRatesQuestion.prompt, 'В каких единицах выражают общие коэффициенты рождаемости и смертности населения?')
assert.equal(demographicRatesQuestion.answer, 'Промилле')
assert.equal(
    demographicRatesQuestion.source.openAnswerBlock.prompt,
    'В каких единицах рассчитываются относительные показатели, характеризующие население?'
)
assert.equal(demographicRatesQuestion.source.openAnswerBlock.answer, 'Промилле')
assert.equal(
    demographicRatesQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef,
    requiredPromptEvidenceRefs.get(demographicRatesQuestion.id)
)

const hanEthnicGroupQuestion = data.grades.find(({ grade }) => grade === 8).questions[15]
assert.equal(hanEthnicGroupQuestion.prompt, 'Какая этническая группа является самой многочисленной в Китае?')
assert.equal(hanEthnicGroupQuestion.answer, 'Ханьцы')
assert.equal(hanEthnicGroupQuestion.source.openAnswerBlock.prompt, 'Как именуют себя китайцы?')
assert.equal(hanEthnicGroupQuestion.source.openAnswerBlock.answer, 'Ханьцами')
assert.equal(
    hanEthnicGroupQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef,
    requiredPromptEvidenceRefs.get(hanEthnicGroupQuestion.id)
)

const leapYearQuestion = data.grades.find(({ grade }) => grade === 11).questions[5]
assert.equal(
    leapYearQuestion.prompt,
    'Какой год в фольклоре связывают с новым началом в отношениях, когда женщина может сделать предложение мужчине?'
)
assert.equal(leapYearQuestion.answer, 'Високосный')
assert.equal(leapYearQuestion.reviewNotes.length, 0)
assert.equal(
    leapYearQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef,
    requiredPromptEvidenceRefs.get(leapYearQuestion.id)
)

const scythianBurialQuestion = data.grades.find(({ grade }) => grade === 11).questions[9]
assert.equal(
    scythianBurialQuestion.prompt,
    'В результате какого события древние скифы оказывались в погребальных камерах курганов, а живые покидали свои дома?'
)
assert.equal(scythianBurialQuestion.answer, 'После смерти')
assert.equal(scythianBurialQuestion.reviewNotes.length, 0)
assert.equal(
    scythianBurialQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef,
    requiredPromptEvidenceRefs.get(scythianBurialQuestion.id)
)

const skeletonQuestion = data.grades.find(({ grade }) => grade === 8).questions[17]
assert.equal(skeletonQuestion.answer, '206')
assert.deepEqual(skeletonQuestion.options.map((option) => option.text).sort(), ['150', '180', '206', '250'])
assert.ok(skeletonQuestion.edits.find((edit) => edit.field === 'answerKey')?.evidenceRef?.includes('ncbi.nlm.nih.gov'))

const hallQuestion = data.grades.find(({ grade }) => grade === 6).questions[28]
assert.equal(hallQuestion.prompt, 'Какую зону дистанции в модели проксемики Э. Холла обычно связывают с общением со знакомыми?')
assert.equal(hallQuestion.answer, 'Социальная зона: 1,2–3,7 м')
assert.equal(hallQuestion.reviewNotes.length, 0)
assert.equal(hallQuestion.correctPosition, 2)
assert.equal(hallQuestion.edits.find((edit) => edit.field === 'answerKey')?.evidenceRef, requiredAnswerEvidenceRefs.get(hallQuestion.id))

const exothermicQuestion = data.grades.find(({ grade }) => grade === 9).questions[23]
assert.equal(exothermicQuestion.prompt, 'Какие химические реакции сопровождаются выделением теплоты?')
assert.equal(exothermicQuestion.answer, 'Экзотермических')
assert.equal(exothermicQuestion.reviewNotes.length, 0)

const luxembourgQuestion = data.grades.find(({ grade }) => grade === 11).questions[15]
assert.equal(
    luxembourgQuestion.prompt,
    'В какой стране находится финансовый центр, который Luxembourg for Finance характеризует как панъевропейский банковский центр с глобальным охватом?'
)
assert.equal(luxembourgQuestion.answer, 'Люксембург')
assert.equal(luxembourgQuestion.reviewNotes.length, 0)

const renaissanceQuestion = data.grades.find(({ grade }) => grade === 7).questions[27]
assert.equal(renaissanceQuestion.prompt, 'Назовите стиль в архитектуре эпохи Возрождения.')
assert.equal(renaissanceQuestion.answer, 'Ренессанс')
assert.deepEqual(
    renaissanceQuestion.options.map((option) => option.text),
    ['Готика', 'Барокко', 'Романский стиль', 'Ренессанс']
)

const jetPropulsionQuestion = data.grades.find(({ grade }) => grade === 10).questions[12]
assert.equal(jetPropulsionQuestion.prompt, jetPropulsionQuestion.source.openAnswerBlock.prompt)
assert.equal(jetPropulsionQuestion.answer, 'Кальмар')
assert.ok(jetPropulsionQuestion.options.some((option) => option.text === 'Дельфин' && !option.isCorrect))
assert.ok(!jetPropulsionQuestion.options.some((option) => option.text === 'Медуза'))

const snowQuestion = data.grades.find(({ grade }) => grade === 9).questions[20]
assert.equal(snowQuestion.prompt, 'Верно ли, что снег, отражая солнечный свет, греет Землю?')
assert.equal(snowQuestion.answer, 'Нет')

const naturalistQuestion = data.grades.find(({ grade }) => grade === 9).questions[21]
assert.equal(naturalistQuestion.prompt, 'Кого считают первым естествоиспытателем Нового времени?')
assert.equal(naturalistQuestion.answer, 'Галилео Галилей')

const varyagQuestion = data.grades.find(({ grade }) => grade === 9).questions[6]
assert.match(varyagQuestion.prompt, /экипаж которого затопил корабль после боя/)
assert.equal(varyagQuestion.answer, 'Русско-японская война 1904–1905 гг.')

const inertiaQuestion = data.grades.find(({ grade }) => grade === 10).questions[14]
assert.match(inertiaQuestion.prompt, /предметы продолжают движение при землетрясении/)
assert.equal(inertiaQuestion.answer, 'Инерция')

const heatingQuestion = data.grades.find(({ grade }) => grade === 10).questions[13]
assert.match(heatingQuestion.prompt, /централизованного теплоснабжения при штатном давлении/)
assert.equal(heatingQuestion.answer, 'Нет')

const hydrogenQuestion = data.grades.find(({ grade }) => grade === 10).questions[24]
assert.equal(hydrogenQuestion.prompt, hydrogenQuestion.source.openAnswerBlock.prompt)
assert.equal(hydrogenQuestion.answer, 'Протон')
assert.ok(!hydrogenQuestion.options.some((option) => option.text === 'Катион'))

const waterlilyQuestion = data.grades.find(({ grade }) => grade === 6).questions[3]
assert.equal(waterlilyQuestion.prompt, 'Лист какого растения, плавающего на воде, может выдержать вес трёхлетнего ребёнка?')

const radiogramQuestion = data.grades.find(({ grade }) => grade === 11).questions[22]
assert.equal(radiogramQuestion.prompt, 'Что передал А. С. Попов в радиограмме 1896 года?')
assert.equal(radiogramQuestion.answer, 'Генрих Герц')

const partialCapacityQuestion = data.grades.find(({ grade }) => grade === 8).questions[12]
assert.equal(
    partialCapacityQuestion.prompt,
    'В каком возрастном диапазоне несовершеннолетние обладают частичной дееспособностью по статье 26 ГК РФ?'
)
assert.ok(partialCapacityQuestion.edits.find((edit) => edit.field === 'prompt')?.evidenceRef?.includes('consultant.ru'))

const hemingwayQuestion = data.grades.find(({ grade }) => grade === 10).questions[29]
assert.equal(
    hemingwayQuestion.prompt,
    'Назовите американского писателя, получившего в 1954 году Нобелевскую премию по литературе. Какое его произведение упоминается в формулировке премии?'
)

const originalParserCases = [
    [5, 16, 'Верно ли, что ШАДУФ — это имя древнеегипетского бога?', 'Нет'],
    [10, 10, 'Какое государство — родина Демократии?', 'Греция'],
    [10, 18, 'Непрямое деление клетки — это …', 'Митоз']
]
for (const [grade, number, prompt, answer] of originalParserCases) {
    const parsed = data.grades.find((item) => item.grade === grade).questions[number - 1].source.openAnswerBlock
    assert.deepEqual(parsed, { prompt, answer }, `Grade ${grade}, question ${number} must preserve the full source line around its em dash`)
}

process.stdout.write(
    `Validated ${totalQuestions} questions, ${allOptionIds.size} choices, ${data.editorialEditRegister.length} logged edits, and ${totalReviewNotes} review notes.\n`
)
process.stdout.write(
    sourceFilesAvailable
        ? 'Verified checked-in transcription against all seven original source files and their SHA-256 hashes.\n'
        : 'Verified the locked source transcription digest; original .backup files are unavailable in this checkout.\n'
)
for (const { grade, questions } of data.grades) {
    const counts = [1, 2, 3, 4].map((position) => questions.filter((question) => question.correctPosition === position).length)
    process.stdout.write(`Grade ${grade}: 30 questions; correct positions [${counts.join(', ')}].\n`)
}
