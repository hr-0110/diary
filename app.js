/**
 * ==========================================================================
 * 오늘의 하루는 어땠나요? - 메인 자바스크립트 로직 (app.js)
 * ==========================================================================
 * 주요 기능:
 * 1. ✨ Google Gemini AI API 연동 (실시간 100% 맞춤형 자유 생성)
 * 2. 🔥 Firebase Cloud Firestore 데이터베이스 연동 & 🗑️ 일기 삭제 기능
 * 3. 원하는 과거/원하는 날짜 선택 후 일기 작성 및 저장
 * 4. 캘린더 점(Dot) 개수 표시 및 첫 작성 일기 대표 이모지 적용
 * 5. Web Speech API 기반 음성 인식
 */

// --------------------------------------------------------------------------
// ✨ Google Gemini AI API 키 설정 (구글 AI 스튜디오 스크린샷 속 정확한 키)
// --------------------------------------------------------------------------
const GEMINI_API_KEY = "AQ.Ab8RN6IOfJDiJ1n3atuliGCmX0b7a1E_yfSrbRg7XMsJiZLxkw";

// --------------------------------------------------------------------------
// 🔥 Firebase Cloud Firestore 연결 설정 (사용자 제공 프로젝트)
// --------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDqs3pv9W1txe41454Y7DTpHOUAHPf9td0",
    authDomain: "counsel-5bd84.firebaseapp.com",
    projectId: "counsel-5bd84",
    storageBucket: "counsel-5bd84.firebasestorage.app",
    messagingSenderId: "780839979319",
    appId: "1:780839979319:web:d7b8034dc186536208b2b2",
    measurementId: "G-Y816RMBD9H"
};

// Firebase 앱 초기화 및 Firestore DB 객체 생성
let db = null;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("🔥 Firebase Cloud Firestore 클라우드 데이터베이스 연결 성공!");
    }
} catch (error) {
    console.warn("Firebase 초기화 중 참고사항 (오프라인 로컬 저장소 모드로 작동):", error);
}

// DOM 엘리먼트
const diaryInput = document.getElementById('diary-input');
const charCountSpan = document.getElementById('char-count');
const voiceBtn = document.getElementById('voice-btn');
const voiceBtnText = document.getElementById('voice-btn-text');
const analyzeBtn = document.getElementById('analyze-btn');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const voiceIndicator = document.getElementById('voice-indicator');
const voiceStatusText = document.getElementById('voice-status-text');

// 날짜 선택 DOM 엘리먼트
const entryDatePicker = document.getElementById('entry-date-picker');
const setTodayBtn = document.getElementById('set-today-btn');
const saveNoticeText = document.getElementById('save-notice-text');

// 탭 버튼 및 뷰 엘리먼트
const tabWriteBtn = document.getElementById('tab-write-btn');
const tabCalendarBtn = document.getElementById('tab-calendar-btn');
const viewWrite = document.getElementById('view-write');
const viewCalendar = document.getElementById('view-calendar');

// AI 답변 박스 엘리먼트
const aiResponseBox = document.getElementById('ai-response-box');
const aiDefaultMessage = document.getElementById('ai-default-message');
const aiLoading = document.getElementById('ai-loading');
const aiResult = document.getElementById('ai-result');
const emotionEmoji = document.getElementById('emotion-emoji');
const emotionName = document.getElementById('emotion-name');
const aiMessageText = document.getElementById('ai-message-text');
const analysisStatusTag = document.getElementById('analysis-status-tag');

// 캘린더 DOM 엘리먼트
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const calendarTitle = document.getElementById('calendar-title');
const calendarDaysGrid = document.getElementById('calendar-days-grid');

// 모달 DOM 엘리먼트
const diaryModal = document.getElementById('diary-modal');
const modalDateBadge = document.getElementById('modal-date-badge');
const modalDiaryList = document.getElementById('modal-diary-list');
const closeModalBtn = document.getElementById('close-modal-btn');
const writeOnThisDateBtn = document.getElementById('write-on-this-date-btn');

// 전역 상태 변수
let isRecording = false;
let recognition = null;
let currentDate = new Date(); // 캘린더 조회 날짜
let currentModalDateStr = ''; // 현재 모달 선택 날짜
let cachedDiaries = []; // 메모리 캐시된 일기 목록

// --------------------------------------------------------------------------
// 1. 초기화 및 이벤트 등록
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // 날짜 선택기 기본값을 '오늘 날짜'로 초기화
    initDatePickerToToday();

    // 음성 인식 초기화
    initSpeechRecognition();

    // 입력 이벤트
    diaryInput.addEventListener('input', updateCharCount);

    // 날짜 리셋 버튼
    setTodayBtn.addEventListener('click', initDatePickerToToday);

    // 버튼 이벤트
    voiceBtn.addEventListener('click', toggleVoiceRecognition);
    analyzeBtn.addEventListener('click', analyzeEmotionAndSave);
    sampleBtn.addEventListener('click', fillSampleDiary);
    clearBtn.addEventListener('click', clearDiaryInput);

    // 탭 전환
    tabWriteBtn.addEventListener('click', () => switchTab('write'));
    tabCalendarBtn.addEventListener('click', () => switchTab('calendar'));

    // 캘린더 월 이동
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // 모달 이벤트
    closeModalBtn.addEventListener('click', closeModal);
    diaryModal.addEventListener('click', (e) => {
        if (e.target === diaryModal) closeModal();
    });

    writeOnThisDateBtn.addEventListener('click', handleWriteOnSelectedDate);

    // Firebase 데이터 불러오기 및 캘린더 초기 렌더링
    await fetchDiariesAndRenderCalendar();
});

function initDatePickerToToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    entryDatePicker.value = `${year}-${month}-${day}`;
}

function switchTab(tabName) {
    if (tabName === 'write') {
        tabWriteBtn.classList.add('active');
        tabCalendarBtn.classList.remove('active');
        viewWrite.classList.add('active');
        viewWrite.classList.remove('hidden');
        viewCalendar.classList.add('hidden');
        viewCalendar.classList.remove('active');
    } else {
        tabCalendarBtn.classList.add('active');
        tabWriteBtn.classList.remove('active');
        viewCalendar.classList.add('active');
        viewCalendar.classList.remove('hidden');
        viewWrite.classList.add('hidden');
        viewWrite.classList.remove('active');
        
        fetchDiariesAndRenderCalendar();
    }
}

function updateCharCount() {
    charCountSpan.textContent = diaryInput.value.length;
}

function clearDiaryInput() {
    if (diaryInput.value.trim() !== '') {
        if (confirm('작성 중인 일기 내용을 지우시겠습니까?')) {
            diaryInput.value = '';
            updateCharCount();
            resetAiResponseBox();
        }
    }
}

// --------------------------------------------------------------------------
// 2. Web Speech API 음성 인식
// --------------------------------------------------------------------------
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }

            if (event.results[event.results.length - 1].isFinal) {
                const currentText = diaryInput.value;
                diaryInput.value = currentText ? (currentText.trim() + ' ' + transcript.trim()) : transcript.trim();
                updateCharCount();
                voiceStatusText.textContent = '말씀하신 내용이 적혔습니다. 계속 말씀하셔도 돼요!';
            } else {
                voiceStatusText.textContent = `인식 중: "${transcript}"`;
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                try { recognition.start(); } catch (e) { stopRecordingUI(); }
            } else {
                stopRecordingUI();
            }
        };

        recognition.onerror = (event) => {
            console.error('음성 인식 오류:', event.error);
            if (event.error === 'not-allowed') {
                alert('마이크 접근 권한이 거부되었습니다.');
                stopRecording();
            }
        };
    } else {
        voiceBtn.disabled = true;
        voiceBtn.title = '이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome/Edge 권장).';
    }
}

function toggleVoiceRecognition() {
    if (!recognition) {
        alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
        return;
    }
    if (isRecording) stopRecording();
    else startRecording();
}

function startRecording() {
    try {
        recognition.start();
        isRecording = true;
        voiceBtn.classList.add('active');
        voiceBtnText.textContent = '🎙️ 녹음 중지하기';
        voiceIndicator.classList.remove('hidden');
        diaryInput.classList.add('recording');
        voiceStatusText.textContent = '마이크가 켜졌습니다. 편하게 말씀하세요...';
    } catch (e) { console.error(e); }
}

function stopRecording() {
    isRecording = false;
    if (recognition) recognition.stop();
    stopRecordingUI();
}

function stopRecordingUI() {
    voiceBtn.classList.remove('active');
    voiceBtnText.textContent = '음성으로 입력하기';
    voiceIndicator.classList.add('hidden');
    diaryInput.classList.remove('recording');
}

// --------------------------------------------------------------------------
// 3. 예시 일기 채우기
// --------------------------------------------------------------------------
const sampleDiaries = [
    "오늘 오랫동안 준비했던 중요한 프로젝트 발표를 마쳤다. 처음에는 너무 떨려서 손이 부들부들 떨렸지만 끝까지 잘 마쳐서 뿌듯하고 마음이 한결 가볍다.",
    "아침부터 비가 내리고 일이 마음대로 잘 풀리지 않아서 조금 무기력하고 쓸쓸한 하루였다. 혼자 카페에 앉아 따뜻한 차를 마시며 마음을 달랬다.",
    "친구와 오랜만에 만나 맛있는 음식도 먹고 그동안 못다 한 이야기를 나눴다. 서로의 일상을 공유하며 많이 웃다 보니 스트레스가 싹 달아났다.",
    "온종일 쉬지 않고 일했더니 몸도 마음도 지치고 피곤하다. 머릿속이 복잡해서 아무 생각 없이 쉬고 싶은 날이다. 따뜻한 물로 씻고 자야겠다."
];

function fillSampleDiary() {
    const randomIndex = Math.floor(Math.random() * sampleDiaries.length);
    diaryInput.value = sampleDiaries[randomIndex];
    updateCharCount();
    diaryInput.focus();
}

// --------------------------------------------------------------------------
// 4. ✨ Google Gemini AI API 실시간 맞춤형 자유 생성 엔진
// --------------------------------------------------------------------------

/**
 * Google Gemini API를 직접 호출하여 100% 실시간 맞춤형 자유 대답을 생성합니다.
 */
async function callGeminiApiForEmotion(diaryText) {
    const modelsToTry = [
        "gemini-1.5-flash-latest",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-2.0-flash"
    ];

    const systemPrompt = `
당신은 사람들의 상처받고 지친 마음을 다정하고 포근하게 보듬어주는 AI 마음 상담사입니다.
사용자가 작성한 아래의 일기 내용을 깊이 있게 읽고, 작성자의 감정에 진심으로 공감해 주세요.

[요구사항]
1. 사용자의 일기에서 느껴지는 가장 대표적인 감정 이모지 1개(예: 😃, 🌿, 😢, 😡, 🥱, 😰, 💖 등)와 감정명(예: 기쁨과 성취, 평온과 소소함, 슬픔과 우울, 분노와 답답함, 피로와 번아웃, 불안과 걱정, 사랑과 감사 등)을 선정해 주세요.
2. 오직 이 일기를 쓴 사용자만을 위해 다정하고 포근한 존댓말로 2~3줄의 위로와 응원, 또는 함께 기뻐해 주는 따뜻한 마음의 이야기를 직접 작성해 주세요.
3. 반드시 아래의 순수 JSON 포맷 하나로만 응답해야 합니다 (다른 설명이나 마크다운 백틱 없이 오직 JSON만):

{
  "emoji": "대표 감정 이모지 1개",
  "name": "감정명",
  "message": "Gemini AI가 작성자의 일기를 읽고 직접 지어서 건네는 다정하고 포근한 2~3줄의 이야기"
}

[사용자의 일기]
"${diaryText}"
`;

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: systemPrompt }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.8,
            topP: 0.95
        }
    };

    let lastError = null;

    for (const modelName of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        try {
            console.log(`✨ Gemini AI [${modelName}] 호출 시도 중...`);
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.warn(`[${modelName}] 응답 실패 (HTTP ${response.status}), 다음 모델 시도...`);
                lastError = new Error(`HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            rawText = rawText.trim();

            if (rawText.startsWith("```")) {
                rawText = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
            }

            const parsed = JSON.parse(rawText);
            console.log(`✨ Gemini AI [${modelName}] 자유 생성 응답 성공:`, parsed);

            return {
                emoji: parsed.emoji || "🌿",
                name: parsed.name || "평온과 마음",
                message: parsed.message || "오늘 하루도 참 고생 많으셨어요. 다정한 따스함이 함께하길 바라요."
            };
        } catch (err) {
            console.warn(`[${modelName}] 시도 중 에러:`, err.message);
            lastError = err;
        }
    }

    console.error("✨ Gemini API 최종 실패:", lastError);
    return {
        emoji: "💡",
        name: "Gemini API 안내",
        message: `Gemini API 키 연결을 확인해 주세요 (${lastError ? lastError.message : 'Error'}).\nGoogle AI Studio의 키 권한 및 네트워크 연결을 점검해 주세요.`
    };
}

/**
 * 분석 및 저장 메인 함수
 */
async function analyzeEmotionAndSave() {
    const text = diaryInput.value.trim();

    if (!text) {
        alert('분석할 일기 내용을 입력해 주세요!');
        diaryInput.focus();
        return;
    }

    if (text.length < 5) {
        alert('감정을 더 정확히 분석할 수 있도록 최소 5자 이상 작성해 주세요.');
        diaryInput.focus();
        return;
    }

    showLoadingState();

    // ✨ 100% Gemini AI 실시간 맞춤 분석 호출
    const result = await callGeminiApiForEmotion(text);
    const targetDateStr = entryDatePicker.value || getTodayString();

    showResultState(result, targetDateStr);

    // 🔥 Firebase Cloud Firestore 및 LocalStorage에 비동기 저장
    await saveDiaryToCloudAndLocal(targetDateStr, text, result);
}

// --------------------------------------------------------------------------
// 5. 🔥 Firebase Cloud Firestore 연동, 🗑️ 삭제 및 오프라인 백업 관리
// --------------------------------------------------------------------------

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function fetchDiariesAndRenderCalendar() {
    let diaries = [];

    if (db) {
        try {
            const snapshot = await db.collection("diaries").get();
            snapshot.forEach(doc => {
                diaries.push({ id: doc.id, ...doc.data() });
            });
            console.log("🔥 Firebase에서 일기 데이터를 로드했습니다:", diaries.length, "개");
        } catch (error) {
            console.warn("Firebase 읽기 참고사항, 로컬 데이터 활용:", error);
            diaries = getLocalSavedDiaries();
        }
    } else {
        diaries = getLocalSavedDiaries();
    }

    cachedDiaries = diaries;
    renderCalendar();
}

function getLocalSavedDiaries() {
    const data = localStorage.getItem('diaries_store');
    return data ? JSON.parse(data) : [];
}

async function saveDiaryToCloudAndLocal(targetDateStr, content, result) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const newEntry = {
        date: targetDateStr,
        time: timeStr,
        content: content,
        emotionEmoji: result.emoji,
        emotionName: result.name,
        aiMessage: result.message,
        createdAt: new Date()
    };

    if (db) {
        try {
            const docRef = await db.collection("diaries").add(newEntry);
            console.log("🔥 Firebase Firestore 저장 완료! ID:", docRef.id);
        } catch (error) {
            console.error("Firebase 저장 오류:", error);
        }
    }

    const localDiaries = getLocalSavedDiaries();
    localDiaries.push({ id: Date.now().toString(), ...newEntry });
    localStorage.setItem('diaries_store', JSON.stringify(localDiaries));

    await fetchDiariesAndRenderCalendar();
}

/**
 * 🗑️ 일기 삭제 처리 함수 (Firebase & LocalStorage 동시 삭제)
 */
async function deleteDiaryEntry(diaryId) {
    if (!confirm('이 일기를 정말로 삭제하시겠습니까?')) {
        return;
    }

    // 1. Firebase Firestore에서 삭제 시도
    if (db) {
        try {
            await db.collection("diaries").doc(diaryId).delete();
            console.log("🔥 Firebase 문서 삭제 완료 ID:", diaryId);
        } catch (error) {
            console.warn("Firebase 문서 삭제 중 참고사항:", error);
        }
    }

    // 2. 로컬 스토리지에서 삭제
    let localDiaries = getLocalSavedDiaries();
    localDiaries = localDiaries.filter(item => item.id !== diaryId);
    localStorage.setItem('diaries_store', JSON.stringify(localDiaries));

    // 3. 최신 데이터 동기화 및 캘린더/모달 갱신
    await fetchDiariesAndRenderCalendar();

    // 열려있는 모달 목록 최신화
    const remainingDayEntries = cachedDiaries.filter(entry => entry.date === currentModalDateStr);
    openDiaryModal(currentModalDateStr, remainingDayEntries);
}

// --------------------------------------------------------------------------
// 6. 캘린더 렌더링 로직 (점 개수 & 첫 작성 일기 대표 이모지)
// --------------------------------------------------------------------------

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    calendarTitle.textContent = `${year}년 ${month + 1}월`;

    const allDiaries = cachedDiaries;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    calendarDaysGrid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        calendarDaysGrid.appendChild(emptyCell);
    }

    const todayStr = getTodayString();

    for (let d = 1; d <= lastDate; d++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';

        const dayMonthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        const fullDateStr = `${year}-${dayMonthStr}-${dayStr}`;

        if (fullDateStr === todayStr) {
            dayCell.classList.add('today');
        }

        const dayOfWeek = new Date(year, month, d).getDay();
        if (dayOfWeek === 0) dayCell.classList.add('sun');
        if (dayOfWeek === 6) dayCell.classList.add('sat');

        const dayNumSpan = document.createElement('span');
        dayNumSpan.className = 'day-number';
        dayNumSpan.textContent = d;
        dayCell.appendChild(dayNumSpan);

        const dayEntries = allDiaries.filter(entry => entry.date === fullDateStr);

        const cellEmojiSpan = document.createElement('span');
        cellEmojiSpan.className = 'cell-emoji';

        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'entry-dots';

        if (dayEntries.length > 0) {
            dayCell.classList.add('has-entry');

            // 👉 첫 번째 작성된 일기[0]의 감정 이모지 사용
            const firstEntry = dayEntries[0];
            cellEmojiSpan.textContent = firstEntry.emotionEmoji;

            // 👉 작성한 일기 개수만큼 점(Dot) 표시
            for (let k = 0; k < dayEntries.length; k++) {
                const dot = document.createElement('span');
                dot.className = 'dot';
                dotsContainer.appendChild(dot);
            }
        }

        dayCell.appendChild(cellEmojiSpan);
        dayCell.appendChild(dotsContainer);

        dayCell.addEventListener('click', () => {
            openDiaryModal(fullDateStr, dayEntries);
        });

        calendarDaysGrid.appendChild(dayCell);
    }
}

// --------------------------------------------------------------------------
// 7. 모달 팝업 및 특정 날짜 일기 작성 / 🗑️ 삭제 연동
// --------------------------------------------------------------------------

function openDiaryModal(dateStr, entries) {
    currentModalDateStr = dateStr;
    modalDateBadge.textContent = dateStr;
    modalDiaryList.innerHTML = '';

    if (!entries || entries.length === 0) {
        modalDiaryList.innerHTML = `
            <div class="no-diary-msg">
                <p>💭 이 날짜에 작성된 일기가 없습니다.</p>
                <p style="font-size: 0.85rem; margin-top: 6px;">상단의 '✍️ 이 날짜에 새 일기 쓰기' 버튼을 누르면 일기를 적을 수 있습니다!</p>
            </div>
        `;
    } else {
        entries.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'modal-diary-card';

            card.innerHTML = `
                <div class="modal-card-top">
                    <span class="modal-diary-time">⏰ 작성 시간: ${item.time || '기록됨'} (${index + 1}번째 일기)</span>
                    <button type="button" class="delete-diary-btn" data-id="${item.id}">🗑️ 삭제</button>
                </div>
                <div class="modal-diary-content">${escapeHtml(item.content)}</div>
                <div class="modal-ai-box">
                    <div class="modal-ai-header">
                        <div class="modal-ai-tag">
                            <span>${item.emotionEmoji}</span>
                            <span>${item.emotionName}</span>
                        </div>
                    </div>
                    <p class="modal-ai-message">${escapeHtml(item.aiMessage)}</p>
                </div>
            `;

            // 삭제 버튼 이벤트 연결
            const delBtn = card.querySelector('.delete-diary-btn');
            delBtn.addEventListener('click', () => {
                deleteDiaryEntry(item.id);
            });

            modalDiaryList.appendChild(card);
        });
    }

    diaryModal.classList.remove('hidden');
}

function handleWriteOnSelectedDate() {
    if (!currentModalDateStr) return;

    entryDatePicker.value = currentModalDateStr;
    closeModal();
    switchTab('write');

    resetAiResponseBox();
    diaryInput.value = '';
    updateCharCount();
    diaryInput.focus();
}

function closeModal() {
    diaryModal.classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --------------------------------------------------------------------------
// 8. UI 상태 관리
// --------------------------------------------------------------------------
function showLoadingState() {
    aiDefaultMessage.classList.add('hidden');
    aiResult.classList.add('hidden');
    aiLoading.classList.remove('hidden');

    analysisStatusTag.textContent = 'Gemini AI 실시간 분석 중...';
    analysisStatusTag.className = 'status-tag analyzing';

    analyzeBtn.disabled = true;
    analyzeBtn.style.opacity = '0.7';
}

function showResultState(result, targetDateStr) {
    aiLoading.classList.add('hidden');
    aiResult.classList.remove('hidden');

    emotionEmoji.textContent = result.emoji;
    emotionName.textContent = result.name;
    aiMessageText.textContent = result.message;

    saveNoticeText.textContent = `✨ Gemini AI의 맞춤 답변이 생성되었으며 [${targetDateStr}] 캘린더에 저장되었습니다.`;

    analysisStatusTag.textContent = 'Gemini AI 실시간 대답 완료';
    analysisStatusTag.className = 'status-tag completed';

    analyzeBtn.disabled = false;
    analyzeBtn.style.opacity = '1';

    aiResponseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetAiResponseBox() {
    aiResult.classList.add('hidden');
    aiLoading.classList.add('hidden');
    aiDefaultMessage.classList.remove('hidden');

    analysisStatusTag.textContent = '대기 중';
    analysisStatusTag.className = 'status-tag';
}
