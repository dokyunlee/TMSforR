/**
 * Agentic Crowdsourcing App Controller (Korean Localized Version)
 * Manages view routing, local state, interactive SVGs, 3-Option psychological selectors,
 * Ground-Truth correction loop, Intrinsic motivation survey (NASA-TLX removed), and JSON results export.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize AI Generator
  const aiGenerator = new AgenticMotivationGenerator();

  // App State
  let currentTask = null;

  // Real-time local draft persistence helper
  const saveDraftToStorage = () => {
    if (!currentTask) return;
    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    const draftTask = {
      ...currentTask,
      id: currentTask.id || "task-draft",
      createdAt: currentTask.createdAt || new Date().toISOString()
    };
    tasks[draftTask.id] = draftTask;
    try {
      localStorage.setItem("agentic_tasks", JSON.stringify(tasks));
    } catch {
      showToast("브라우저 임시 저장에 실패했습니다. 배포 저장을 이용해 주세요.");
    }
  };
  let workerSession = {
    taskId: null,
    progress: 0,
    totalItems: 10,
    timerSeconds: 900,
    timerInterval: null,
    timerSpeed: 1,
    selectedOption: null,
    carelessAttempts: 0,
    startTime: null,
    category: "general"
  };

  // Seeding initial default task in localStorage for instant demonstration
  const seedDefaultTask = () => {
    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    // Overwrite default seed task to keep it fresh and perfectly matched
    const defaultTask = {
      id: "task-seed-101",
      title: "폐 X-Ray 영상 판독을 통한 종양 의심 병변 진단",
      category: "medical",
      reward: "2.50",
      timeLimitMinutes: "15",
      description: `### ?? 작업 개요
우리는 "폐 X-Ray 영상 판독" 관련 학습 데이터를 구축하고 있습니다. 목표는 제공된 흉부 방사선 사진에서 종양 의심 조직이나 이상 병변을 세밀하게 판독하고 정확히 분류하는 것입니다.

### ?? 상세 가이드라인 & 분류 수칙
1. 제공된 X-ray 스캔 이미지를 최대한 신중하게 검토하십시오. 미세하게 분포하는 조직의 이상 음영이나 불규칙한 밀도 차이를 관찰하십시오.
2. 분석 대상의 내부 형상을 파악하여 가장 올바르고 정교한 분류 옵션(정상, 이상 발견, 판독 불가)을 선택해 주십시오.
3. 이미지의 왜곡이 심하거나 확실하게 식별할 수 없을 경우, 무리하게 추측하지 말고 선택지 중 가장 보수적인 항목을 선택하십시오.

### ??? 신중도 서약
이 프로젝트에 참여함으로써 귀하는 작업에 온전히 집중할 것을 동의합니다. 귀하가 부여하는 레이블 하나하나에 담긴 소중한 안목이 의료용 진단 알고리즘의 보건 정확성을 제고하고 환자의 귀중한 생명을 지키는 안전망이 됩니다. 감사합니다!`,
      beforeText: "환영합니다! 오늘 저희와 함께 소중한 어노테이션 연구에 참여해 주셔서 진심으로 감사드립니다. 귀하께서 수행하실 이번 업무는 단순한 클릭 작업이 아닙니다. 이 작업은 즉각적으로 폐 X-ray 스캔 이미지에서 폐 종양 의심 이상 병변의 세밀한 형상을 정밀하게 판독함으로써, 궁극적으로 환자의 고귀한 생명을 수호하고 질병 조기 진단 인공지능 기술의 임상적 신뢰도를 극대화하는 데 기여하는 핵심적인 기여 활동입니다. 반복적인 템포 속에서 소외감을 느끼실 수 있으나, 귀하의 세심한 시각이 엮어내는 참값 데이터는 우리 사회의 보이지 않는 안전망이자 생명을 보호하는 소중한 연결고리가 될 것입니다. 높은 책임감을 갖고 동참해 주시는 귀하의 공헌에 진심으로 경의를 표합니다.",
      afterText: "경이로운 기여를 완성하셨습니다! 귀하의 소중한 참여로 모든 주석 레이블링 과정이 전격 완수되었습니다. 귀하가 부지런히 심어주신 엄밀한 판단 조각들은 정밀하게 구조화되어, 마침내 의료 연구 및 병변 판독 영역을 한 단계 앞당기는 가장 핵심적인 초석으로 남게 되었습니다. 기술의 안전성과 진보를 위해 함께 힘써 주신 작업자님께 온 마음을 담아 뜨거운 감사를 올립니다. 귀하의 성실한 공헌으로 승인된 보상금 $2.50은(는) 안전하게 확인되어 귀하의 계정으로 즉시 지급 승인 처리 완료되었습니다. 수고 많으셨습니다!",
      theme: "의료 연구 및 병변 판독 (Medical Research & Diagnostics)",
      createdAt: new Date().toISOString(),
      riskLevel: "medium",
      fatigueLevel: "medium",
      objective: "폐 X-ray 스캔 이미지에서 폐 종양 의심 이상 병변의 세밀한 형상을 파악하기",
      socialImpact: "환자의 생명을 구하고 의료용 진단 알고리즘의 보건 정확성을 제고하기",
      workerContext: "장시간 피로가 누적된 상태에서 모니터를 응시하며 미세 조직 판독에 집중하는 원격 작업 환경"
    };
    tasks[defaultTask.id] = defaultTask;
    localStorage.setItem("agentic_tasks", JSON.stringify(tasks));
  };

  seedDefaultTask();

  // DOM Elements - General Router
  const requesterView = document.getElementById("requester-view");
  const workerView = document.getElementById("worker-view");
  const navTabRequester = document.getElementById("nav-tab-requester");
  const navTabWorker = document.getElementById("nav-tab-worker");

  // DOM Elements - Requester Form
  const taskForm = document.getElementById("task-form");
  const btnGenerate = document.getElementById("btn-generate");
  const btnPublish = document.getElementById("btn-publish");
  const btnResetForm = document.getElementById("btn-reset-form");
  const formCompletionText = document.getElementById("form-completion-text");
  const formCompletionFill = document.getElementById("form-completion-fill");

  const taskTitleBox = document.getElementById("task-title");
  const taskRewardBox = document.getElementById("task-reward");
  const taskTimeLimitBox = document.getElementById("task-time-limit");
  const taskDescBox = document.getElementById("task-desc");
  const taskRiskLevelSelect = document.getElementById("task-risk-level");
  const taskFatigueLevelSelect = document.getElementById("task-fatigue-level");
  const taskObjectiveBox = document.getElementById("task-objective");
  const taskSocialImpactBox = document.getElementById("task-social-impact");
  const taskWorkerContextBox = document.getElementById("task-worker-context");
  const testCaseButtons = document.querySelectorAll("[data-test-case]");

  const aiLogBox = document.getElementById("ai-log-box");
  const generationMonitorBar = document.getElementById("generation-monitor-bar");
  const previewContainer = document.getElementById("preview-container");
  const reviewEmptyState = document.getElementById("review-empty-state");
  const beforeTextBox = document.getElementById("before-text");
  const afterTextBox = document.getElementById("after-text");
  const finalBeforeTextBox = document.getElementById("final-before-text");
  const finalAfterTextBox = document.getElementById("final-after-text");

  const psychologyFactorPanel = document.getElementById("psychology-factor-panel");
  const llmProviderBadge = document.getElementById("llm-provider-badge");
  const factorTaskTypes = document.getElementById("factor-task-types");
  const factorSelectedFrames = document.getElementById("factor-selected-frames");
  const factorBurdens = document.getElementById("factor-burdens");
  const factorMotivators = document.getElementById("factor-motivators");
  const factorSelectionReason = document.getElementById("factor-selection-reason");

  const shareCard = document.getElementById("share-card");
  const shareLinkInput = document.getElementById("share-link-input");
  const btnCopyLink = document.getElementById("btn-copy-link");
  const btnOpenWorker = document.getElementById("btn-open-worker");
  const btnExportResults = document.getElementById("btn-export-results");
  const shareCreatedAt = document.getElementById("share-created-at");

  // DOM Elements - Worker Pre-Task
  const workerPreTask = document.getElementById("worker-pre-task");
  const workerWorkspace = document.getElementById("worker-workspace");
  const workerPostTask = document.getElementById("worker-post-task");
  const workerTaskError = document.getElementById("worker-task-error");

  const workerTaskTitle = document.getElementById("worker-task-title");
  const workerTaskReward = document.getElementById("worker-task-reward");
  const workerMotivationPrime = document.getElementById("worker-motivation-prime");
  const workspaceMotivationPrime = document.getElementById("workspace-motivation-prime");
  const workspaceTaskDesc = document.getElementById("workspace-task-desc");
  const workerSpecReward = document.getElementById("worker-spec-reward");
  const workerSpecTimeLimit = document.getElementById("worker-spec-time-limit");
  const btnStartTask = document.getElementById("btn-start-task");
  const workspaceTaskTitle = document.getElementById("workspace-task-title");

  // DOM Elements - Active Labeling Workspace
  const canvasImgContainer = document.getElementById("canvas-image-container");
  const canvasLoading = document.getElementById("canvas-loading");

  const labelProgressText = document.getElementById("label-progress-text");
  const progressBarInner = document.getElementById("progress-bar-inner");
  const labelTimer = document.getElementById("label-timer");

  const labelingQuestion = document.getElementById("labeling-question");
  const optionsWrapper = document.getElementById("options-wrapper");
  const btnSubmitAnnotation = document.getElementById("btn-submit-annotation");

  // DOM Elements - Worker Post-Task Completed
  const postTaskAppreciationText = document.getElementById("post-task-appreciation-text");
  const postMetricReward = document.getElementById("post-metric-reward");
  const btnWorkerExport = document.getElementById("btn-worker-export");
  const btnBackToRequester = document.getElementById("btn-back-to-requester");

  // Toast Notification System
  const toastNotice = document.getElementById("toast-notice");
  const toastNoticeText = document.getElementById("toast-notice-text");

  const showToast = (message) => {
    toastNoticeText.textContent = message;
    toastNotice.classList.add("show");
    setTimeout(() => {
      toastNotice.classList.remove("show");
    }, 3000);
  };

  const setGenerationStep = (stepName, status = "active") => {
    if (!generationMonitorBar) return;
    const step = generationMonitorBar.querySelector(`[data-step="${stepName}"]`);
    if (!step) return;
    step.classList.remove("active", "done", "warn");
    if (status) step.classList.add(status);
  };

  const resetGenerationMonitor = () => {
    if (!generationMonitorBar) return;
    generationMonitorBar.querySelectorAll(".monitor-step").forEach(step => {
      step.classList.remove("active", "done", "warn");
    });
  };

  const startWaitingLog = (label, intervalMs = 15000) => {
    const startedAt = Date.now();
    addThoughtLog(`${label} 요청을 전송했습니다. 처리 상태를 확인할 수 있도록 경과 시간을 표시합니다.`, "wait");
    return setInterval(() => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      addThoughtLog(`${label} 작성 처리 중... ${seconds}초 경과`, "wait");
    }, intervalMs);
  };

  // State variables
  let selectedCategory = "general";
  let synthesizedBeforeOptions = [];
  let synthesizedAfterOptions = [];
  let synthesizedBeforeLabels = ["의미감/사회적 가치", "유능감/판단 신뢰", "자율성/부담 완화"];
  let synthesizedAfterLabels = ["감사/관계성", "기여/유능감", "자율적 마무리"];
  let selectedBeforeOptionIndex = 0;
  let selectedAfterOptionIndex = 0;
  let latestPsychologicalFactors = null;
  let latestStructuredPrompt = "";
  let latestLLMProvider = "local";
  let latestLLMModel = "";

  const testCasePresets = {
    case1: {
      category: "medical",
      title: "폐 X-Ray 영상에서 종양 의심 병변 판독",
      reward: "2.50",
      timeLimitMinutes: "15",
      riskLevel: "medium",
      fatigueLevel: "high",
      objective: "폐 X-Ray 이미지에서 종양 의심 병변의 존재 여부를 정확히 분류하기",
      socialImpact: "의료 영상 진단 알고리즘의 학습 데이터를 개선하여 조기 진단 정확도 향상에 기여하기",
      workerContext: "장시간 화면을 보며 미세한 음영 차이를 반복적으로 확인해야 하는 원격 판독 환경",
      description: `### 작업 개요
제공된 폐 X-Ray 이미지를 보고 종양 의심 병변이 보이는지 판단하는 의료 영상 라벨링 작업입니다. 각 이미지는 정상, 이상 의심, 판독 불가 중 하나로 분류합니다.

### 상세 가이드라인
1. 이미지의 좌우 폐 영역을 천천히 확인하고 비정상적인 결절, 음영, 경계가 있는지 살펴봅니다.
2. 확실하지 않은 경우 추측하지 말고 판독 불가를 선택합니다.
3. 반복 작업으로 피로가 생길 수 있으므로 각 항목을 같은 기준으로 차분히 확인합니다.`
    },
    case2: {
      category: "autonomous",
      title: "자율주행 도로 장면의 보행자 및 장애물 분류",
      reward: "1.80",
      timeLimitMinutes: "12",
      riskLevel: "medium",
      fatigueLevel: "medium",
      objective: "도로 이미지에서 보행자, 차량, 장애물의 존재 여부를 라벨링하기",
      socialImpact: "자율주행 모델의 위험 인식 성능을 높여 보행자와 운전자의 안전을 개선하기",
      workerContext: "짧은 시간 안에 여러 도로 장면을 반복적으로 확인하며 작은 객체를 구분해야 하는 작업 환경",
      description: `### 작업 개요
제공된 도로 장면 이미지를 보고 교통 안전과 관련된 주요 객체를 분류하는 작업입니다. 보행자, 일반 차량, 도로 장애물, 객체 없음 중 가장 적절한 항목을 선택합니다.

### 상세 가이드라인
1. 하이라이트된 영역 안쪽의 객체를 우선 확인합니다.
2. 보행자가 보이면 다른 객체보다 보행자 라벨을 우선합니다.
3. 객체가 흐리거나 가려져 판단이 어려우면 가장 보수적인 안전 기준으로 선택합니다.`
    },
    case3: {
      category: "moderation",
      title: "온라인 댓글의 유해성 및 정책 위반 여부 검토",
      reward: "1.20",
      timeLimitMinutes: "10",
      riskLevel: "high",
      fatigueLevel: "high",
      objective: "댓글 텍스트가 욕설, 위협, 괴롭힘, 스팸 등 정책 위반에 해당하는지 분류하기",
      socialImpact: "온라인 커뮤니티 이용자가 안전하게 대화할 수 있도록 유해 콘텐츠 노출을 줄이기",
      workerContext: "정서적으로 불편할 수 있는 텍스트를 반복적으로 읽고 규칙에 따라 판단해야 하는 검토 환경",
      description: `### 작업 개요
제공된 댓글이나 게시글을 읽고 커뮤니티 정책 위반 여부를 분류하는 콘텐츠 모더레이션 작업입니다. 정상, 공격적 표현, 스팸/사기, 판단 불가 중 하나를 선택합니다.

### 상세 가이드라인
1. 비판이나 불만 표현 자체는 위반으로 보지 않고, 직접적인 욕설, 위협, 괴롭힘 여부를 중심으로 판단합니다.
2. 개인정보 요구, 금전 유도, 반복 광고 문구는 스팸/사기 가능성으로 분류합니다.
3. 불쾌한 표현이 포함될 수 있으므로 무리해서 감정적으로 해석하지 말고 기준에 맞춰 판단합니다.`
    }
  };

  const postJSON = async (url, payload, timeoutMs = 130000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`문구 생성 응답 시간이 ${Math.round(timeoutMs / 1000)}초를 초과했습니다.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `요청 실패 (${response.status})`);
    }
    return data;
  };

  const saveTaskToServer = async (task) => {
    try {
      await postJSON("/api/tasks", { task }, 130000);
      return true;
    } catch (error) {
      addThoughtLog?.(`[서버 저장] 작업 저장 실패: ${error.message}`, "warning");
      return false;
    }
  };

  const loadTaskFromServer = async (taskId) => {
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.task || null;
    } catch {
      return null;
    }
  };

  const saveResultToServer = async (record) => {
    try {
      await postJSON("/api/results", { record }, 30000);
    } catch {
      // Local result storage remains the fallback for prototype runs.
    }
  };

  const getTaskPayloadFromForm = () => ({
    title: taskTitleBox.value.trim(),
    reward: taskRewardBox.value.trim() || "1.50",
    timeLimitMinutes: taskTimeLimitBox.value.trim() || "15",
    description: taskDescBox.value.trim(),
    category: selectedCategory,
    riskLevel: taskRiskLevelSelect.value,
    fatigueLevel: taskFatigueLevelSelect.value,
    objective: taskObjectiveBox.value.trim(),
    socialImpact: taskSocialImpactBox.value.trim(),
    workerContext: taskWorkerContextBox.value.trim()
  });

  const extractOptionMessages = (options = []) => options
    .map(option => typeof option === "string" ? option : (option?.message || option?.text || ""))
    .filter(Boolean);

  const extractOptionLabels = (options = [], fallbackLabels = []) => options
    .map((option, idx) => typeof option === "string" ? fallbackLabels[idx] : (option?.label || fallbackLabels[idx]))
    .filter(Boolean);

  const ensureThree = (values, fallbackValues) => {
    const merged = [...values];
    fallbackValues.forEach(value => {
      if (merged.length < 3) merged.push(value);
    });
    return merged.slice(0, 3);
  };

  const normalizeGenerationResult = (raw, fallback, title = "") => {
    const beforeMessages = ensureThree(extractOptionMessages(raw.beforeOptions), fallback.beforeOptions);
    const afterMessages = ensureThree(extractOptionMessages(raw.afterOptions), fallback.afterOptions);
    const beforeLabels = ensureThree(extractOptionLabels(raw.beforeOptions, fallback.beforeLabels), fallback.beforeLabels);
    const afterLabels = ensureThree(extractOptionLabels(raw.afterOptions, fallback.afterLabels), fallback.afterLabels);
    const psychologicalFactors = raw.psychologicalFactors || {
      inferredTaskTypes: [],
      psychologicalBurdens: raw.psychologicalBurden || [],
      motivationalFactors: raw.motivationalOpportunity || [],
      sdtNeeds: [],
      selectedFrames: raw.selectedFrames || [],
      frameSelectionReason: "",
      constraintsApplied: []
    };

    const rawSelectedFrames = psychologicalFactors.selectedFrames || raw.selectedFrames || [];
    const fallbackSelectedFrames = fallback.psychologicalFactors?.selectedFrames || fallback.selectedFrames || [];
    const selectedFrames = Array.isArray(rawSelectedFrames) && rawSelectedFrames.length === 2
      ? rawSelectedFrames
      : fallbackSelectedFrames.slice(0, 2);

    psychologicalFactors.primaryTaskType = psychologicalFactors.primaryTaskType || fallback.psychologicalFactors?.primaryTaskType || fallback.primaryTaskType || "";
    psychologicalFactors.primaryPsychologicalType = psychologicalFactors.primaryPsychologicalType || fallback.psychologicalFactors?.primaryPsychologicalType || "";
    psychologicalFactors.selectedFrames = selectedFrames;
    psychologicalFactors.psychologicalBurdens = psychologicalFactors.psychologicalBurdens || raw.psychologicalBurden || [];
    psychologicalFactors.motivationalFactors = psychologicalFactors.motivationalFactors || raw.motivationalOpportunity || [];

    const composedFinalBeforeText = aiGenerator.composeFinalBeforeFromCandidates(
      title,
      selectedFrames,
      beforeMessages,
      fallback.finalBeforeText || raw.finalBeforeText || beforeMessages[0]
    );

    return {
      beforeOptions: beforeMessages,
      afterOptions: afterMessages,
      beforeLabels,
      afterLabels,
      psychologicalFactors,
      selectedFrames: psychologicalFactors.selectedFrames || [],
      psychologicalBurden: psychologicalFactors.psychologicalBurdens || [],
      motivationalOpportunity: psychologicalFactors.motivationalFactors || [],
      structuredPrompt: raw.structuredPrompt || raw.structuredPromptSummary || fallback.structuredPrompt || "",
      theme: raw.theme || fallback.theme || "",
      finalBeforeText: composedFinalBeforeText,
      finalAfterText: aiGenerator.polishAfterMessage(raw.finalAfterText || fallback.finalAfterText || afterMessages[0]),
      provider: raw.provider || "local",
      model: raw.model || ""
    };
  };

  const toDisplayFactorLabel = value => {
    const label = String(value || "").trim();
    const labelMap = {
      "Autonomy support": "자율성 지지",
      "Competence": "유능감",
      "Meaningfulness/Relatedness": "의미감(관계성)",
      "Relatedness/Appreciation": "관계성(감사·공감)"
    };
    return labelMap[label] || label;
  };

  const renderPills = (container, items = []) => {
    if (!container) return;
    container.innerHTML = "";
    items.forEach(item => {
      const value = typeof item === "string" ? item : item.type;
      if (!value) return;
      const pill = document.createElement("span");
      pill.className = "factor-pill";
      pill.textContent = toDisplayFactorLabel(value);
      container.appendChild(pill);
    });
  };

  const renderList = (container, items = []) => {
    if (!container) return;
    container.innerHTML = "";
    items.slice(0, 4).forEach(item => {
      const li = document.createElement("li");
      li.textContent = typeof item === "string" ? item : JSON.stringify(item);
      container.appendChild(li);
    });
  };

  const renderPsychologicalFactors = (factors, provider, model) => {
    latestPsychologicalFactors = factors;
    if (!psychologyFactorPanel || !factors) return;

    renderPills(factorTaskTypes, factors.inferredTaskTypes || []);
    renderPills(factorSelectedFrames, factors.selectedFrames || []);
    renderList(factorBurdens, factors.psychologicalBurdens || []);
    renderList(factorMotivators, factors.motivationalFactors || []);

    if (factorSelectionReason) {
      factorSelectionReason.textContent = factors.frameSelectionReason || "새 카테고리 규칙에 따라 작업 특성과 심리 프레임을 연결했습니다.";
    }
    if (llmProviderBadge) {
      llmProviderBadge.textContent = provider === "upstage" ? `외부 작성${model ? ` · ${model}` : ""}` : "브라우저 작성";
    }
    psychologyFactorPanel.classList.remove("hidden");
  };

  const syncSelectedCandidateText = () => {
    if (synthesizedBeforeOptions.length > 0) {
      synthesizedBeforeOptions[selectedBeforeOptionIndex] = beforeTextBox.value;
    }
    if (synthesizedAfterOptions.length > 0) {
      synthesizedAfterOptions[selectedAfterOptionIndex] = afterTextBox.value;
    }
    if (currentTask) {
      currentTask.beforeCandidates = [...synthesizedBeforeOptions];
      currentTask.afterCandidates = [...synthesizedAfterOptions];
      currentTask.finalBeforeText = finalBeforeTextBox.value;
      currentTask.finalAfterText = finalAfterTextBox.value;
      currentTask.beforeText = finalBeforeTextBox.value || beforeTextBox.value;
      currentTask.afterText = finalAfterTextBox.value || afterTextBox.value;
      saveDraftToStorage();
    }
  };

  // Routing Handler using Hash Parsing
  const handleRouting = () => {
    const hash = window.location.hash;
    clearInterval(workerSession.timerInterval);

    if (hash.startsWith("#worker")) {
      document.body.classList.add("worker-mode");
      document.body.classList.remove("requester-mode");
      requesterView.classList.add("hidden");
      workerView.classList.remove("hidden");
      navTabRequester.classList.remove("active");
      navTabWorker.classList.add("active");

      const query = hash.split("?")[1];
      const params = new URLSearchParams(query);
      let taskId = params.get("taskId");

      if (!taskId) {
        const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
        if (tasks["task-draft"]) {
          taskId = "task-draft";
        } else if (currentTask && currentTask.id) {
          taskId = currentTask.id;
        } else {
          const taskList = Object.values(tasks);
          if (taskList.length > 0) {
            taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            taskId = taskList[0].id;
          }
        }
      }
      if (!taskId) {
        taskId = "task-seed-101";
      }

      loadWorkerTask(taskId);
    } else {
      document.body.classList.remove("worker-mode");
      document.body.classList.add("requester-mode");
      requesterView.classList.remove("hidden");
      workerView.classList.add("hidden");
      navTabRequester.classList.add("active");
      navTabWorker.classList.remove("active");
    }
  };

  window.addEventListener("hashchange", handleRouting);
  navTabRequester.addEventListener("click", () => { window.location.hash = "#requester"; });
  navTabWorker.addEventListener("click", () => { window.location.hash = "#worker"; });

  // ==========================================================================
  // REQUESTER: TASK PRESETS AND GENERATION
  // ==========================================================================

  const applyTestCasePreset = (caseId) => {
    const preset = testCasePresets[caseId];
    if (!preset) return;

    selectedCategory = preset.category;
    taskTitleBox.value = preset.title;
    taskRewardBox.value = preset.reward;
    taskTimeLimitBox.value = preset.timeLimitMinutes || "15";
    taskDescBox.value = preset.description;
    taskRiskLevelSelect.value = preset.riskLevel;
    taskFatigueLevelSelect.value = preset.fatigueLevel;
    taskObjectiveBox.value = preset.objective;
    taskSocialImpactBox.value = preset.socialImpact;
    taskWorkerContextBox.value = preset.workerContext;

    currentTask = {
      id: "task-draft",
      title: preset.title,
      category: preset.category,
      reward: preset.reward,
      timeLimitMinutes: preset.timeLimitMinutes || "15",
      description: preset.description,
      riskLevel: preset.riskLevel,
      fatigueLevel: preset.fatigueLevel,
      objective: preset.objective,
      socialImpact: preset.socialImpact,
      workerContext: preset.workerContext,
      beforeText: "",
      afterText: "",
      beforeCandidates: [],
      afterCandidates: [],
      createdAt: new Date().toISOString()
    };

    saveDraftToStorage();
    updateFormCompletion();
    resetGenerationMonitor();
    previewContainer?.classList.add("hidden");
    reviewEmptyState?.classList.remove("hidden");
    shareCard?.classList.add("hidden");
    showToast(`${caseId === "case1" ? "의료 예시" : caseId === "case2" ? "교통 예시" : "댓글 검토 예시"}가 입력되었습니다.`);
  };

  testCaseButtons.forEach(button => {
    button.addEventListener("click", () => applyTestCasePreset(button.dataset.testCase));
  });

  // Requester convenience: completion meter, validation, reset
  const requiredFormFields = [
    { el: taskTitleBox, label: "작업 제목" },
    { el: taskRewardBox, label: "보상금" },
    { el: taskTimeLimitBox, label: "시간 제한" },
    { el: taskDescBox, label: "작업 지침" },
    { el: taskObjectiveBox, label: "작업 목표" }
  ];

  const updateFormCompletion = () => {
    const completed = requiredFormFields.filter(item => item.el && item.el.value.trim()).length;
    const total = requiredFormFields.length;
    if (formCompletionText) formCompletionText.textContent = `필수 입력 ${completed} / ${total}`;
    if (formCompletionFill) formCompletionFill.style.width = `${Math.round((completed / total) * 100)}%`;
  };

  const validateRequiredFields = () => {
    const missing = requiredFormFields.filter(item => !item.el || !item.el.value.trim());
    requiredFormFields.forEach(item => item.el?.classList.remove("is-invalid"));
    missing.forEach(item => item.el?.classList.add("is-invalid"));
    updateFormCompletion();
    return missing;
  };

  requiredFormFields.forEach(item => {
    item.el?.addEventListener("input", () => {
      item.el.classList.remove("is-invalid");
      updateFormCompletion();
    });
  });

  btnResetForm?.addEventListener("click", () => {
    [taskTitleBox, taskRewardBox, taskTimeLimitBox, taskDescBox, taskObjectiveBox, taskSocialImpactBox, taskWorkerContextBox].forEach(el => {
      if (el) el.value = "";
    });
    if (taskRiskLevelSelect) taskRiskLevelSelect.value = "medium";
    if (taskFatigueLevelSelect) taskFatigueLevelSelect.value = "medium";
    currentTask = null;
    synthesizedBeforeOptions = [];
    synthesizedAfterOptions = [];
    previewContainer?.classList.add("hidden");
    reviewEmptyState?.classList.remove("hidden");
    shareCard?.classList.add("hidden");
    resetGenerationMonitor();
    if (aiLogBox) {
      aiLogBox.innerHTML = '<div class="ai-thought-line ai-thought-system">입력값이 초기화되었습니다. 새 작업 정보를 입력해 주세요.</div>';
    }
    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    delete tasks["task-draft"];
    localStorage.setItem("agentic_tasks", JSON.stringify(tasks));
    requiredFormFields.forEach(item => item.el?.classList.remove("is-invalid"));
    updateFormCompletion();
    showToast("입력값이 초기화되었습니다.");
  });

  // Trigger Motivation Synthesis
  btnGenerate.addEventListener("click", async (e) => {
    e.preventDefault();

	    const payload = getTaskPayloadFromForm();
    const generationPayload = payload;

    const missingFields = validateRequiredFields();
    if (missingFields.length > 0) {
      showToast(`필수 항목을 입력해 주세요: ${missingFields.map(item => item.label).join(", ")}`);
      missingFields[0].el?.focus();
      return;
    }

    btnGenerate.disabled = true;
    const originalGenerateButtonHTML = btnGenerate.innerHTML;
    btnGenerate.innerHTML = `<i class="lucide-loader"></i>문구 생성 중`;
    if (aiLogBox) aiLogBox.innerHTML = "";
    resetGenerationMonitor();
    previewContainer?.classList.add("hidden");
    reviewEmptyState?.classList.add("hidden");
    shareCard?.classList.add("hidden");

    try {
      setGenerationStep("metadata", "active");
      addThoughtLog(`[입력 수집] 작업 제목, 보상, 상세 지침, 위험도(${payload.riskLevel}), 피로도(${payload.fatigueLevel}), 작업 목표, 사회적 가치, 작업 수행 특성을 수집했습니다.`, "meta");
      addThoughtLog(`[입력 요약] 제목: ${payload.title} / 목표: ${payload.objective || "설명에서 자동 추론"} / 사회적 가치: ${payload.socialImpact || "카테고리 기반 자동 추론"}`, "meta");
      setGenerationStep("metadata", "done");

      setGenerationStep("factors", "active");
      // Play explainable agent log. This is not private chain-of-thought; it mirrors the PDF-described pipeline.
      await aiGenerator.generateThoughtsLog(
        generationPayload.title,
        generationPayload.category,
        generationPayload.description,
        generationPayload.riskLevel,
        generationPayload.fatigueLevel,
        generationPayload.objective,
        generationPayload.socialImpact,
        generationPayload.workerContext,
        addThoughtLog
      );
      setGenerationStep("factors", "done");
      setGenerationStep("frames", "active");

      const fallbackResults = aiGenerator.generateInterventions(
        generationPayload.title,
        generationPayload.category,
        generationPayload.description,
        generationPayload.riskLevel,
        generationPayload.fatigueLevel,
        generationPayload.objective,
        generationPayload.socialImpact,
        generationPayload.workerContext,
        generationPayload.reward
      );
      const fallbackFactors = fallbackResults.psychologicalFactors || {};
      addThoughtLog(`[카테고리 규칙] 감지된 작업 카테고리: ${(fallbackFactors.inferredTaskTypes || []).map(item => item.type || item).join(", ") || "General Low-Stakes Tasks"}`, "process");
      addThoughtLog(`[카테고리 규칙] 선택 프레임: ${(fallbackFactors.selectedFrames || fallbackResults.selectedFrames || []).join(" + ")}`, "process");
      setGenerationStep("frames", "done");
      setGenerationStep("constraints", "active");
      addThoughtLog("[제약조건] 후보 문구는 각각 자연스럽게 이어지는 한국어 5문장으로 만들고, 최종 작업 전 문구는 선택 프레임 2개에 해당하는 후보 2개를 문장 수 제한 없이 자연스럽게 섞습니다.", "process");
      setGenerationStep("constraints", "done");

      let rawResults;
      let waitLogInterval = null;
      try {
        setGenerationStep("llm", "active");
        addThoughtLog("[생성] 작업 특성에 맞춰 후보 문구와 최종 문구를 구성합니다.", "process");
        waitLogInterval = startWaitingLog("문구 생성");
        rawResults = await postJSON("/api/generate-motivation", generationPayload);
        clearInterval(waitLogInterval);
        addThoughtLog(`[생성] 후보 문구를 준비했습니다. 작업 전 ${rawResults.beforeOptions?.length || 0}개 / 작업 후 ${rawResults.afterOptions?.length || 0}개`, "success");
        setGenerationStep("llm", "done");
      } catch (error) {
        if (waitLogInterval) clearInterval(waitLogInterval);
        rawResults = { ...fallbackResults, provider: "local" };
        setGenerationStep("llm", "warn");
        addThoughtLog(`[로컬 생성] 외부 생성 실패: ${error.message}`, "warning");
        addThoughtLog("[로컬 생성] 저장된 카테고리 규칙으로 후보/최종 문구를 구성합니다.", "process");
        showToast("외부 생성에 실패해 로컬 규칙 기반 후보를 생성했습니다.");
      }

      setGenerationStep("render", "active");
      const results = normalizeGenerationResult(rawResults, fallbackResults, payload.title);
      latestLLMProvider = results.provider;
      latestLLMModel = results.model;
      latestStructuredPrompt = results.structuredPrompt || "";
      addThoughtLog(`[결과 정렬] 후보 문구 6개와 최종 작업 전/후 문구를 화면에 렌더링할 준비를 마쳤습니다.`, "process");

      // Save lists globally for option switching and manual edits.
      synthesizedBeforeOptions = results.beforeOptions;
      synthesizedAfterOptions = results.afterOptions;
      synthesizedBeforeLabels = results.beforeLabels || synthesizedBeforeLabels;
      synthesizedAfterLabels = results.afterLabels || synthesizedAfterLabels;
      selectedBeforeOptionIndex = 0;
      selectedAfterOptionIndex = 0;

      currentTask = {
        id: "task-draft",
        title: payload.title,
        category: payload.category,
        reward: payload.reward,
        timeLimitMinutes: payload.timeLimitMinutes,
        description: payload.description,
        beforeText: results.finalBeforeText,
        afterText: results.finalAfterText,
        beforeCandidates: [...synthesizedBeforeOptions],
        afterCandidates: [...synthesizedAfterOptions],
        finalBeforeText: results.finalBeforeText,
        finalAfterText: results.finalAfterText,
        theme: results.theme,
        psychologicalFactors: results.psychologicalFactors,
        selectedFrames: results.selectedFrames || [],
        psychologicalBurden: results.psychologicalBurden || [],
        motivationalOpportunity: results.motivationalOpportunity || [],
        structuredPrompt: latestStructuredPrompt,
        llmProvider: latestLLMProvider,
        llmModel: latestLLMModel,
        riskLevel: payload.riskLevel,
        fatigueLevel: payload.fatigueLevel,
        objective: payload.objective,
        socialImpact: payload.socialImpact,
        workerContext: payload.workerContext,
        createdAt: new Date().toISOString()
      };

      saveDraftToStorage();

      renderOptionSelectors();
      renderPsychologicalFactors(results.psychologicalFactors, latestLLMProvider, latestLLMModel);

      beforeTextBox.value = synthesizedBeforeOptions[0];
      afterTextBox.value = synthesizedAfterOptions[0];
      finalBeforeTextBox.value = results.finalBeforeText;
      finalAfterTextBox.value = results.finalAfterText;

      previewContainer?.classList.remove("hidden");
      reviewEmptyState?.classList.add("hidden");
      setGenerationStep("render", "done");
      addThoughtLog("[완료] 요청자는 후보 문구와 최종 문구를 직접 확인·수정한 뒤 현재 최종 문구로 작업을 배포할 수 있습니다.", "success");
      previewContainer?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.innerHTML = originalGenerateButtonHTML;
    }
  });

  const addThoughtLog = (text, type = "") => {
    if (!aiLogBox) return;
    const logLine = document.createElement("div");
    logLine.className = `ai-thought-line ai-thought-${type}`;
    const timeNode = document.createElement("span");
    timeNode.className = "ai-thought-time";
    timeNode.textContent = `[${new Date().toLocaleTimeString("ko-KR", { hour12: false })}]`;
    logLine.append(timeNode, document.createTextNode(` ${text}`));
    aiLogBox.appendChild(logLine);
    aiLogBox.scrollTop = aiLogBox.scrollHeight;
  };

  // Render 3-Option Tab selectors dynamically
  const renderOptionSelectors = () => {
    const beforeSelectGroup = document.getElementById("before-options-select-group");
    const afterSelectGroup = document.getElementById("after-options-select-group");

    beforeSelectGroup.innerHTML = "";
    afterSelectGroup.innerHTML = "";

    // 3 Options for Before-Task
    const beforeTitles = synthesizedBeforeLabels;
    beforeTitles.forEach((title, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `option-select-btn${idx === selectedBeforeOptionIndex ? " active" : ""}`;
      const icon = document.createElement("i");
      icon.className = "lucide-sparkles";
      const label = document.createElement("span");
      label.textContent = title;
      btn.append(icon, label);
      btn.addEventListener("click", () => {
        syncSelectedCandidateText();
        beforeSelectGroup.querySelectorAll(".option-select-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedBeforeOptionIndex = idx;
        beforeTextBox.value = synthesizedBeforeOptions[idx];
        if (currentTask) {
          currentTask.beforeCandidates = [...synthesizedBeforeOptions];
          saveDraftToStorage();
        }
        showToast(`작업 전 후보 문구: [${title}] 선택됨`);
      });
      beforeSelectGroup.appendChild(btn);
    });

    // 3 Options for After-Task
    const afterTitles = synthesizedAfterLabels;
    afterTitles.forEach((title, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `option-select-btn${idx === selectedAfterOptionIndex ? " active" : ""}`;
      const icon = document.createElement("i");
      icon.className = "lucide-award";
      const label = document.createElement("span");
      label.textContent = title;
      btn.append(icon, label);
      btn.addEventListener("click", () => {
        syncSelectedCandidateText();
        afterSelectGroup.querySelectorAll(".option-select-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedAfterOptionIndex = idx;
        afterTextBox.value = synthesizedAfterOptions[idx];
        if (currentTask) {
          currentTask.afterCandidates = [...synthesizedAfterOptions];
          saveDraftToStorage();
        }
        showToast(`작업 후 후보 문구: [${title}] 선택됨`);
      });
      afterSelectGroup.appendChild(btn);
    });
  };

  // Publish Task Campaign
  btnPublish.addEventListener("click", async () => {
    if (!currentTask) return;
    syncSelectedCandidateText();

    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    // Clean up temporary draft on formal publish
    delete tasks["task-draft"];

    currentTask.beforeText = finalBeforeTextBox.value || beforeTextBox.value;
    currentTask.afterText = finalAfterTextBox.value || afterTextBox.value;
    currentTask.finalBeforeText = currentTask.beforeText;
    currentTask.finalAfterText = currentTask.afterText;
    currentTask.timeLimitMinutes = taskTimeLimitBox.value.trim() || currentTask.timeLimitMinutes || "15";
    currentTask.beforeCandidates = [...synthesizedBeforeOptions];
    currentTask.afterCandidates = [...synthesizedAfterOptions];
    currentTask.psychologicalFactors = latestPsychologicalFactors;
    currentTask.structuredPrompt = latestStructuredPrompt;
    currentTask.llmProvider = latestLLMProvider;
    currentTask.llmModel = latestLLMModel;
    currentTask.id = "task-" + Date.now();
    currentTask.createdAt = new Date().toISOString();

    tasks[currentTask.id] = currentTask;
    try {
      localStorage.setItem("agentic_tasks", JSON.stringify(tasks));
    } catch {
      showToast("미디어 용량이 커서 브라우저 임시 저장은 건너뛰었습니다.");
    }

    const serverSaved = await saveTaskToServer(currentTask);

    const workerUrl = `${window.location.origin}${window.location.pathname}#worker?taskId=${currentTask.id}`;
    shareLinkInput.value = workerUrl;
    if (shareCreatedAt) {
      shareCreatedAt.textContent = `${new Date().toLocaleString("ko-KR", { hour12: false })} 생성`;
    }
    const shareStatusText = document.getElementById("share-status-text");
    if (shareStatusText) {
      shareStatusText.textContent = serverSaved ? "서버 저장 완료" : "링크 생성";
    }

    shareCard.classList.remove("hidden");
    showToast(serverSaved ? "작업자 링크와 서버 저장이 완료되었습니다." : "작업자 링크가 생성되었습니다. 서버 저장은 실패했습니다.");
    shareCard.scrollIntoView({ behavior: "smooth", block: "end" });
  });

  // Helper to ensure currentTask exists and sync draft
  const syncFormToDraft = () => {
    if (!currentTask) {
      currentTask = {
        id: "task-draft",
        title: "",
        category: selectedCategory,
        reward: "1.50",
        timeLimitMinutes: "15",
        description: "",
        beforeText: "귀하의 세심한 인지적 가치는 고품질 데이터 구축의 핵심 주춧돌이 됩니다. 높은 자부심을 갖고 동참해 주시기 바랍니다.",
        afterText: "경이로운 기여를 완성하셨습니다! 소중한 노고에 진심으로 깊이 감사드립니다.",
        createdAt: new Date().toISOString()
      };
    }
    currentTask.title = taskTitleBox.value.trim();
    currentTask.reward = taskRewardBox.value.trim() || "1.50";
    currentTask.timeLimitMinutes = taskTimeLimitBox.value.trim() || "15";
    currentTask.description = taskDescBox.value.trim();
    currentTask.category = selectedCategory;
    currentTask.riskLevel = taskRiskLevelSelect.value;
    currentTask.fatigueLevel = taskFatigueLevelSelect.value;
    currentTask.objective = taskObjectiveBox.value.trim();
    currentTask.socialImpact = taskSocialImpactBox.value.trim();
    currentTask.workerContext = taskWorkerContextBox.value.trim();
    saveDraftToStorage();
  };

  taskTitleBox.addEventListener("input", syncFormToDraft);
  taskRewardBox.addEventListener("input", syncFormToDraft);
  taskTimeLimitBox.addEventListener("input", syncFormToDraft);
  taskDescBox.addEventListener("input", syncFormToDraft);
  taskRiskLevelSelect.addEventListener("change", syncFormToDraft);
  taskFatigueLevelSelect.addEventListener("change", syncFormToDraft);
  taskObjectiveBox.addEventListener("input", syncFormToDraft);
  taskSocialImpactBox.addEventListener("input", syncFormToDraft);
  taskWorkerContextBox.addEventListener("input", syncFormToDraft);

  // Real-time synchronization of manual edits to the textareas
  beforeTextBox.addEventListener("input", () => {
    if (synthesizedBeforeOptions.length > 0) {
      synthesizedBeforeOptions[selectedBeforeOptionIndex] = beforeTextBox.value;
    }
    if (currentTask) {
      currentTask.beforeCandidates = [...synthesizedBeforeOptions];
      saveDraftToStorage();
    }
  });

  afterTextBox.addEventListener("input", () => {
    if (synthesizedAfterOptions.length > 0) {
      synthesizedAfterOptions[selectedAfterOptionIndex] = afterTextBox.value;
    }
    if (currentTask) {
      currentTask.afterCandidates = [...synthesizedAfterOptions];
      saveDraftToStorage();
    }
  });

  finalBeforeTextBox.addEventListener("input", () => {
    if (currentTask) {
      currentTask.beforeText = finalBeforeTextBox.value;
      currentTask.finalBeforeText = finalBeforeTextBox.value;
      saveDraftToStorage();
    }
  });

  finalAfterTextBox.addEventListener("input", () => {
    if (currentTask) {
      currentTask.afterText = finalAfterTextBox.value;
      currentTask.finalAfterText = finalAfterTextBox.value;
      saveDraftToStorage();
    }
  });

  btnCopyLink.addEventListener("click", () => {
    shareLinkInput.select();
    navigator.clipboard.writeText(shareLinkInput.value);
    showToast("작업자 링크가 클립보드에 복사되었습니다.");
  });

  btnOpenWorker.addEventListener("click", () => {
    if (shareLinkInput.value) {
      window.open(shareLinkInput.value, "_blank");
    }
  });

  // Export Complete Research Logs JSON Button (NASA-TLX and survey parameters removed)
  const handleJSONExport = () => {
    const results = JSON.parse(localStorage.getItem("agentic_results")) || [];
    
    // Sample seed database loaded from results.json (Ground-Truth and survey variables excised)
    const baseDatabase = [
      {
        "taskId": "task-seed-101",
        "taskTitle": "폐 X-Ray 영상 판독을 통한 종양 의심 병변 진단",
        "category": "medical",
        "reward": "2.50",
        "riskLevel": "medium",
        "fatigueLevel": "medium",
        "objective": "폐 X-ray 스캔 이미지에서 폐 종양 의심 이상 병변의 세밀한 형상을 파악하기",
        "socialImpact": "환자의 생명을 구하고 의료용 진단 알고리즘의 보건 정확성을 제고하기",
        "workerContext": "장시간 피로가 누적된 상태에서 모니터를 응시하며 미세 조직 판독에 집중하는 원격 작업 환경",
        "workerSession": {
          "completedAt": "2026-05-21T10:00:00Z",
          "elapsedSeconds": 340
        }
      }
    ];

    const finalReport = [...baseDatabase, ...results];

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalReport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "results.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("results.json 다운로드가 완료되었습니다.");
  };

  btnExportResults?.addEventListener("click", handleJSONExport);
  btnWorkerExport?.addEventListener("click", handleJSONExport);

  // ========================================================================== 
  // CROWD WORKER: PRE-TASK WORKSPACE
  // ========================================================================== 

  const escapeGuidelineHTML = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const formatGuidelineInline = (value = "") => escapeGuidelineHTML(value)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong class="guideline-emphasis">$1</strong>');

  const isNaturalGuidelineHeading = (line = "") => {
    const text = line.trim();
    if (!text || text.length > 40) return false;

    const commonHeading = /^(?:\d+[.)]\s*)?(?:작업\s*개요|상세\s*가이드라인|가이드라인|판단\s*기준|분류\s*기준|작업\s*절차|진행\s*방법|주의\s*사항|유의\s*사항|예외\s*사항|참고\s*사항|작업\s*목표|제출\s*기준)(?:\s*[:：])?$/i;
    const bracketHeading = /^\[[^\]]{2,30}\]$/;
    const shortLabel = /^[^.!?。]{2,24}[:：]$/;
    return commonHeading.test(text) || bracketHeading.test(text) || shortLabel.test(text);
  };

  const renderGuidelineMarkdown = (description = "", compact = false) => String(description)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((originalLine) => {
      const line = originalLine.trim();
      if (!line) return '<div class="guideline-spacer" aria-hidden="true"></div>';

      const markdownHeading = line.match(/^(#{1,6})\s*(.+?)\s*#*$/);
      if (markdownHeading) {
        const level = markdownHeading[1].length <= 2 ? "title" : "subtitle";
        return `<div class="guideline-heading guideline-heading-${level}${compact ? " is-compact" : ""}">${formatGuidelineInline(markdownHeading[2])}</div>`;
      }

      const standaloneBold = line.match(/^\*\*(.+?)\*\*$/);
      if (standaloneBold) {
        return `<div class="guideline-heading guideline-heading-subtitle${compact ? " is-compact" : ""}">${formatGuidelineInline(standaloneBold[1])}</div>`;
      }

      if (isNaturalGuidelineHeading(line)) {
        return `<div class="guideline-heading guideline-heading-subtitle${compact ? " is-compact" : ""}">${formatGuidelineInline(line)}</div>`;
      }

      const lineType = /^(?:[-*•]|\d+[.)])\s+/.test(line) ? " guideline-list-line" : "";
      return `<div class="guideline-line${lineType}">${formatGuidelineInline(originalLine)}</div>`;
    })
    .join("");

  const renderGuidelineDescription = (container, description, compact = false) => {
    if (!container) return;
    if (!description) {
      container.innerHTML = '<span class="guideline-empty">게시된 상세 가이드라인이 존재하지 않습니다.</span>';
      return;
    }
    container.innerHTML = renderGuidelineMarkdown(description, compact);
  };

  const loadWorkerTask = async (taskId) => {
    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    let task = await loadTaskFromServer(taskId);
    if (!task) task = tasks[taskId];

    if (!task) {
      workerTaskError.classList.remove("hidden");
      workerPreTask.classList.add("hidden");
      workerWorkspace.classList.add("hidden");
      workerPostTask.classList.add("hidden");
      return;
    }

    workerTaskError.classList.add("hidden");
    workerPreTask.classList.remove("hidden");
    workerWorkspace.classList.add("hidden");
    workerPostTask.classList.add("hidden");

    // Initialize session state
    workerSession.taskId = taskId;
    workerSession.progress = 0;
    workerSession.totalItems = 10;
    const timeLimitMinutes = parseInt(task.timeLimitMinutes || "15", 10);
    const safeTimeLimitMinutes = Number.isFinite(timeLimitMinutes)
      ? Math.min(Math.max(timeLimitMinutes, 1), 180)
      : 15;
    workerSession.timerSeconds = safeTimeLimitMinutes * 60;
    workerSession.timerSpeed = 1;
    workerSession.selectedOption = null;
    workerSession.category = task.category;
    workerSession.startTime = Date.now();

    // Bind values safely with null checks to prevent script crashes
    if (workerTaskTitle) {
      workerTaskTitle.textContent = task.title || "크라우드소싱 주석 작업";
    }
    if (workspaceTaskTitle) {
      workspaceTaskTitle.textContent = task.title || "크라우드소싱 주석 작업";
    }
    if (workerTaskReward) {
      workerTaskReward.textContent = `$${task.reward || "1.50"}`;
    }
    if (workerSpecReward) {
      workerSpecReward.textContent = `$${task.reward || "1.50"}`;
    }
    if (workerSpecTimeLimit) {
      workerSpecTimeLimit.textContent = `${safeTimeLimitMinutes} 분`;
    }

    if (workerMotivationPrime) {
      workerMotivationPrime.textContent = task.beforeText || "귀하의 세심한 인지적 가치는 고품질 데이터 구축의 핵심 주춧돌이 됩니다.";
    }
    if (workspaceMotivationPrime) {
      workspaceMotivationPrime.textContent = task.beforeText || "귀하의 세심한 인지적 가치는 고품질 데이터 구축의 핵심 주춧돌이 됩니다.";
    }

    // Preserve the stored guideline text and format Markdown only in worker previews.
    const workerTaskDesc = document.getElementById("worker-task-desc");
    renderGuidelineDescription(workerTaskDesc, task.description);
    renderGuidelineDescription(workspaceTaskDesc, task.description, true);
  };

  // Start Campaign Task Workspace
  btnStartTask.addEventListener("click", () => {
    workerPreTask.classList.add("hidden");
    workerWorkspace.classList.remove("hidden");

    // Render SVGs
    renderImageCanvas();
    renderLabelingOptions();

    // Start countdown
    startCountdown();
  });

  // ==========================================================================
  // SIMULATED COUNTDOWN CLOCK
  // ==========================================================================
  const startCountdown = () => {
    clearInterval(workerSession.timerInterval);

    const updateDisplay = () => {
      const mins = Math.floor(workerSession.timerSeconds / 60);
      const secs = workerSession.timerSeconds % 60;
      labelTimer.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      if (workerSession.timerSeconds < 180) {
        labelTimer.parentElement.classList.add("timer-critical");
      } else {
        labelTimer.parentElement.classList.remove("timer-critical");
      }
    };

    updateDisplay();

    workerSession.timerInterval = setInterval(() => {
      workerSession.timerSeconds -= 1;

      if (workerSession.timerSeconds <= 0) {
        workerSession.timerSeconds = 0;
        clearInterval(workerSession.timerInterval);
        showToast("제한 시간이 종료되어 작업이 완료 처리됩니다.");
        completeLabelingItems();
      }

      updateDisplay();
    }, 1000);
  };

  // ==========================================================================
  // SIMULATED ANNOTATOR CANVAS
  // ==========================================================================
  const generateDynamicSVGAsset = (category, index) => {
    const width = 500;
    const height = 300;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; font-family:'Inter', sans-serif;">`;
    svgContent += `<rect width="100%" height="100%" fill="#f8fafc"/>`;
    svgContent += `<g stroke="rgba(15,23,42,0.07)" stroke-width="1">`;
    for (let x = 0; x < width; x += 25) svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
    for (let y = 0; y < height; y += 25) svgContent += `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    svgContent += `</g>`;

    if (category === "medical") {
      svgContent += `
        <path d="M 120 40 Q 180 80 180 260 M 380 40 Q 320 80 320 260" stroke="#94a3b8" stroke-width="12" fill="none" opacity="0.65"/>
        <path d="M 130 80 C 190 120 190 200 175 250 M 370 80 C 310 120 310 200 325 250" stroke="#94a3b8" stroke-width="8" fill="none" opacity="0.65"/>
        
        <path d="M 180 60 Q 100 80 120 240 Q 180 270 200 240 Q 210 160 180 60" fill="rgba(148, 163, 184, 0.25)" stroke="#64748b" stroke-width="2"/>
        <path d="M 320 60 Q 400 80 380 240 Q 320 270 300 240 Q 290 160 320 60" fill="rgba(148, 163, 184, 0.25)" stroke="#64748b" stroke-width="2"/>
        
        <rect x="240" y="30" width="20" height="240" rx="3" fill="#cbd5e1" opacity="0.8"/>
      `;

      if (index === 2 || index === 5 || index === 8) {
        const cx = index === 2 ? 150 : 340;
        const cy = index === 2 ? 140 : 185;
        const radius = index === 2 ? 22 : 15;
        svgContent += `
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" stroke-dasharray="3,3" stroke-width="2">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <line x1="${cx - radius - 15}" y1="${cy}" x2="${cx - radius - 2}" y2="${cy}" stroke="#f43f5e" stroke-width="1.5"/>
          <line x1="${cx + radius + 2}" y1="${cy}" x2="${cx + radius + 15}" y2="${cy}" stroke="#f43f5e" stroke-width="1.5"/>
          <line x1="${cx}" y1="${cy - radius - 15}" x2="${cx}" y2="${cy - radius - 2}" stroke="#f43f5e" stroke-width="1.5"/>
          <line x1="${cx}" y1="${cy + radius + 2}" x2="${cx}" y2="${cy + radius + 15}" stroke="#f43f5e" stroke-width="1.5"/>
        `;
      }
    } else if (category === "autonomous") {
      svgContent += `
        <polygon points="210,130 290,130 450,300 50,300" fill="#cbd5e1"/>
        <line x1="250" y1="130" x2="250" y2="300" stroke="#e11d48" stroke-width="2" stroke-dasharray="8,8"/>
        
        <rect x="0" y="0" width="500" height="130" fill="#0f172a" opacity="0.8"/>
        <path d="M 0 130 L 80 90 L 150 110 L 220 80 L 310 120 L 420 95 L 500 130 Z" fill="#020617"/>
        
        <g transform="translate(${index % 2 === 0 ? '160, 160' : '230, 140'}) scale(${index % 2 === 0 ? '1.1' : '0.7'})">
          <rect x="10" y="30" width="100" height="40" rx="8" fill="none" stroke="#38bdf8" stroke-width="2"/>
          <path d="M 25 30 L 35 10 L 85 10 L 95 30" fill="none" stroke="#38bdf8" stroke-width="2"/>
          <circle cx="30" cy="70" r="12" fill="none" stroke="#38bdf8" stroke-width="2"/>
          <circle cx="90" cy="70" r="12" fill="none" stroke="#38bdf8" stroke-width="2"/>
        </g>
      `;

      if (index === 1 || index === 4 || index === 7) {
        svgContent += `
          <g transform="translate(100, 140)">
            <rect x="0" y="0" width="40" height="90" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,4"/>
            <rect x="0" y="-18" width="30" height="18" fill="#a855f7"/>
            <text x="3" y="-5" fill="white" font-size="8" font-weight="700">PEDESTRIAN</text>
            
            <circle cx="20" cy="18" r="8" fill="#f472b6"/>
            <line x1="20" y1="26" x2="20" y2="60" stroke="#f472b6" stroke-width="4"/>
            <line x1="20" y1="35" x2="5" y2="50" stroke="#f472b6" stroke-width="3"/>
            <line x1="20" y1="35" x2="35" y2="50" stroke="#f472b6" stroke-width="3"/>
            <line x1="20" y1="60" x2="10" y2="85" stroke="#f472b6" stroke-width="3.5"/>
            <line x1="20" y1="60" x2="30" y2="85" stroke="#f472b6" stroke-width="3.5"/>
          </g>
        `;
      }
    } else if (category === "moderation") {
      const toxicComments = [
        "이 스레드 인간들 다 진짜 혐오스럽고 가식적이다. 이딴 식의 뇌 없는 소리 지껄일 거면 다 탈퇴하고 영원히 꺼져라. 쓰레기들.",
        "제시하신 정책 제안서는 다소 근거가 부족해 보입니다. 여기에 반박 연구 리포트 링크를 첨부하니 차분하게 토론해 봅시다.",
        "GO KILL YOURSELF! 당장 자살해라! 너 어디 사는지 뒷조사 끝냈고, 그따위 한심한 글 올린 대가를 철저히 치르게 만들어 줄 테니까 각오해라.",
        "이번에 새로 산 쿼드콥터 촬영 장치가 꽤 쓸만하네요. 배터리 타임도 45분 이상 버텨줘서 만족스럽게 야외 촬영 중입니다.",
        "진짜 돌대가리 멍청이 티 내네. 한 번만 더 지껄이면 네 집 주소랑 모든 개인정보 다 털어서 박제할 줄 알아라. 더러운 것들.",
        "단지 주민 자치회 수영장이 내일 아침 성인 자유형 수영 타임에 개방하는지 아시는 분 계신가요? 고맙습니다!",
        "이 판매자 사기꾼입니다! 번개장터 거래했는데 50만원 입금받자마자 차단 박고 잠수 탔습니다. 절대 입금하지 마세요.",
        "시내 베이커리 빵집의 목요일 아침 블루베리 스콘이 정말 맛있어요. 아침 9시 전에는 가야 솔드아웃 안 되고 살 수 있습니다.",
        "그냥 몹쓸 병에 걸려 서서히 고통스럽게 망했으면 좋겠다. 인간 이하의 쓰레기를 마주하느라 내 기분만 더럽네.",
        "단지 주민 자치회 수영장이 내일 아침 성인 자유형 수영 타임에 개방하는지 아시는 분 계신가요?"
      ];

      const commentText = toxicComments[index % toxicComments.length];
      const isToxic = index % 2 === 0; // Toxic comment at index 0, 2, 4, 6, 8

      svgContent += `
        <foreignObject x="25" y="40" width="450" height="220">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color:#1f2937; font-size:12px; line-height:1.5; background:#ffffff; padding:16px; border-radius:10px; border:1px solid #e5e7eb; height: 100%; box-sizing: border-box; box-shadow:0 6px 18px rgba(17,24,39,0.08);">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #e5e7eb; padding-bottom:6px;">
              <span style="font-weight:700; color:#2563eb; font-family:'Inter', sans-serif;">User_ID: 익명_작업자_${1000 + index}</span>
              <span style="font-size:10px; color:#6b7280;">게시글 번호 #15,${200 + index}</span>
            </div>
            <p style="font-style: italic; color:#111827; background:#f8fafc; padding:8px; border-radius:6px; border-left: 3px solid ${isToxic ? '#ef4444' : '#14b8a6'}">
              "${commentText}"
            </p>
            <div style="margin-top:10px; font-size:10px; color:#6b7280;">
              <span style="background:${isToxic ? '#fef2f2' : '#ecfdf5'}; color:${isToxic ? '#b91c1c' : '#047857'}; padding:2px 6px; border-radius:999px; font-weight:700;">
                ${isToxic ? '규정 위반 가능성 있음' : '규정 준수 텍스트'}
              </span>
            </div>
          </div>
        </foreignObject>
      `;
    } else {
      const isSymmetrical = index % 2 === 0;
      svgContent += `
        <circle cx="250" cy="150" r="70" fill="none" stroke="#14b8a6" stroke-width="3"/>
        <circle cx="250" cy="150" r="3" fill="#14b8a6"/>
        
        <g transform="translate(225, 125) ${isSymmetrical ? 'rotate(0)' : 'rotate(-45, 25, 25)'}">
          <polygon points="25,0 50,45 0,45" fill="rgba(245, 158, 11, 0.3)" stroke="#f59e0b" stroke-width="2"/>
        </g>
        <text x="250" y="245" fill="#94a3b8" font-size="12" text-anchor="middle">검증 타겟 상태: ${isSymmetrical ? '완전 대칭 구조 (0도)' : '비대칭 왼쪽 기울임 (-45도)'}</text>
      `;
    }

    svgContent += `</svg>`;
    return svgContent;
  };

  const renderImageCanvas = () => {
    canvasLoading.classList.add("active");

    setTimeout(() => {
      const svg = generateDynamicSVGAsset(workerSession.category, workerSession.progress);
      canvasImgContainer.innerHTML = svg;
      canvasLoading.classList.remove("active");
    }, 350);
  };

  // Render classification options and questions
  const renderLabelingOptions = () => {
    optionsWrapper.innerHTML = "";
    workerSession.selectedOption = null;
    btnSubmitAnnotation.disabled = true;

    let questionText = "캔버스의 가이드를 참고하여 판독을 확정하십시오:";
    let options = [];

    if (workerSession.category === "medical") {
      questionText = "제공된 흉부 X-ray 스캔 이미지에 종양 의심 조밀도 병변 조각이 존재합니까?";
      options = [
        "정상 소견: 특이 질감 또는 병변 이상 없음",
        "이상 소견 발견: 유의미한 결절 종양 흔적 감지됨",
        "판독 불가: 이미지 노이즈 및 저해상도 초점 흐림"
      ];
    } else if (workerSession.category === "autonomous") {
      questionText = "하이라이트된 도로 바운딩 박스 안쪽의 교통 위해 장애물을 분류하십시오:";
      options = [
        "장애물 없음: 안전 주행 차선",
        "보행자 실루엣 감지됨",
        "일반 승용차 차체 감지됨",
        "도로 공사용 차단막 장애물 감지됨"
      ];
    } else if (workerSession.category === "moderation") {
      questionText = "해당 유저 댓글 게시물이 위협이나 언어 비하 규정을 위반하는 공격적 성향을 보입니까?";
      options = [
        "깨끗한 텍스트: 커뮤니티 지침 준수",
        "악성 게시물: 공격성 폭언/하라스먼트 규정 위반",
        "스팸 광고성: 상업 홍보 및 도배성 불필요 정보"
      ];
    } else {
      questionText = "중앙 캔버스의 타겟 이미지 요소의 회전 지향 방향을 결정해 주십시오:";
      options = [
        "완전한 대칭 배향 (0도 회전)",
        "비대칭 왼쪽 편향 (-45도 경사)",
        "비대칭 오른쪽 편향 (+45도 경사)"
      ];
    }

    labelingQuestion.textContent = questionText;

    options.forEach((opt, idx) => {
      const optBtn = document.createElement("button");
      optBtn.className = "option-btn";
      optBtn.textContent = opt;
      optBtn.setAttribute("data-index", idx);

      optBtn.addEventListener("click", () => {
        const optionButtons = optionsWrapper.querySelectorAll(".option-btn");
        optionButtons.forEach(btn => btn.classList.remove("selected"));
        optBtn.classList.add("selected");

        workerSession.selectedOption = idx;
        btnSubmitAnnotation.disabled = false;
      });

      optionsWrapper.appendChild(optBtn);
    });

    // Update progress numbers
    labelProgressText.textContent = `${workerSession.progress} / ${workerSession.totalItems}`;
    progressBarInner.style.width = `${(workerSession.progress / workerSession.totalItems) * 100}%`;

  };

  // Get Ground Truth target indexes and reasoning
  const getGroundTruthForAsset = (category, index) => {
    let correctIdx = 0;
    let explanation = "";

    if (category === "medical") {
      const isAnomalous = (index === 2 || index === 5 || index === 8);
      correctIdx = isAnomalous ? 1 : 0;
      explanation = isAnomalous
        ? "해당 방사선 스캔은 검사 원 안쪽에 뚜렷한 조밀 결절 음영을 표출하고 있습니다. 표시된 붉은 점선 영역을 재확인하십시오."
        : "폐의 모든 갈비뼈 하단 조직이 맑고 고른 투명도를 띠고 있습니다. 비정상적인 종양성 결절 흔적은 부재합니다.";
    } else if (category === "autonomous") {
      const isPedestrian = (index === 1 || index === 4 || index === 7);
      correctIdx = isPedestrian ? 1 : 2;
      explanation = isPedestrian
        ? "바운딩 어레이 박스 안쪽의 차선 중앙에 분홍색 보행자 실루엣이 가로막고 있어 안전 정지가 필요합니다."
        : "중심 프레임에 잡힌 것은 선행 승용차의 후미 차체입니다. 이는 표준적인 차량 장애물 패턴에 정렬됩니다.";
    } else if (category === "moderation") {
      const isToxic = (index % 2 === 0);
      correctIdx = isToxic ? 1 : 0;
      explanation = isToxic
        ? "유저 코멘트 내부에는 혐오적 멸칭, 신상 털기 협박 및 직접 비하 단어군이 분포하여 직접적 위반 수위를 충족합니다."
        : "해당 코멘트는 가벼운 질의이거나 상대 제안 반론 성격으로, 폭언이나 모욕 규정을 침해하지 않는 안심 댓글입니다.";
    } else {
      const isSymmetrical = (index % 2 === 0);
      correctIdx = isSymmetrical ? 0 : 1;
      explanation = isSymmetrical
        ? "폴리곤 벡터 정점이 비틀림 없이 정교하게 수직 y축 중심선을 가리키며 균일 대칭을 이루고 있습니다."
        : "타겟 이미지 요소가 반시계 방향으로 45도 편향 경사 상태를 띠어 왼쪽 비대칭 분류 구조를 충족합니다.";
    }

    return { correctIdx, explanation };
  };

  // Submit Annotation directly
  btnSubmitAnnotation.addEventListener("click", () => {
    if (workerSession.selectedOption === null) return;

    showToast("제출되었습니다. 다음 항목으로 이동합니다.");
    workerSession.progress += 1;

    if (workerSession.progress >= workerSession.totalItems) {
      completeLabelingItems();
    } else {
      renderImageCanvas();
      renderLabelingOptions();
    }
  });

  // Finished 10 labeling tasks -> Transition directly to final panel
  const completeLabelingItems = () => {
    clearInterval(workerSession.timerInterval);

    workerWorkspace.classList.add("hidden");
    workerPostTask.classList.remove("hidden");

    const tasks = JSON.parse(localStorage.getItem("agentic_tasks")) || {};
    const task = tasks[workerSession.taskId] || {};

    // Compile complete research results payload
    const sessionRecord = {
      taskId: workerSession.taskId,
      taskTitle: task.title || "크라우드 주석 작업",
      category: workerSession.category,
      reward: task.reward || "1.50",
      timeLimitMinutes: task.timeLimitMinutes || "15",
      riskLevel: task.riskLevel || "medium",
      fatigueLevel: task.fatigueLevel || "medium",
      objective: task.objective || "",
      socialImpact: task.socialImpact || "",
      workerContext: task.workerContext || "",
      psychologicalFactors: task.psychologicalFactors || null,
      selectedFrames: task.selectedFrames || [],
      structuredPrompt: task.structuredPrompt || "",
      beforeCandidates: task.beforeCandidates || [],
      afterCandidates: task.afterCandidates || [],
      finalBeforeText: task.finalBeforeText || task.beforeText || "",
      finalAfterText: task.finalAfterText || task.afterText || "",
      llmProvider: task.llmProvider || "local",
      llmModel: task.llmModel || "",
      workerSession: {
        completedAt: new Date().toISOString(),
        elapsedSeconds: Math.round((Date.now() - workerSession.startTime) / 1000)
      }
    };

    // Save session record to results database in cache
    const results = JSON.parse(localStorage.getItem("agentic_results")) || [];
    results.push(sessionRecord);
    localStorage.setItem("agentic_results", JSON.stringify(results));
    saveResultToServer(sessionRecord);

    postTaskAppreciationText.textContent = task.afterText || "성공적으로 어노테이션 임무가 완수되었습니다. 감사합니다!";

    // Bind final UI stats (Only approved reward is shown since accuracy and warnings are removed)
    postMetricReward.textContent = `$${task.reward || "1.50"}`;

    // Celebrate with confetti!
    if (typeof confetti === "function") {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.65 } });
      setTimeout(() => {
        confetti({ particleCount: 100, spread: 120, origin: { y: 0.55 } });
      }, 350);
    }
  };

  btnBackToRequester?.addEventListener("click", () => {
    window.location.hash = "#requester";
  });

  updateFormCompletion();

  // Load router views on init
  handleRouting();
});
