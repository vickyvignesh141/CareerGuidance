// =========================
// carpre.js (FINAL UPDATE — wallet localStorage + restored action-plan listeners fix)
// - Persist uploaded files (wallet) in localStorage as data URLs (1st, 2nd, 3rd... uploads)
// - Restore files and keep View/Delete/Open working across sessions
// - Re-attach action-plan buttons when actionPlan HTML is restored from localStorage
// - Single right-aligned small blue "Re-run Agent" button (visible during questions & after results)
// - Full file: ready to paste as carpre.js
// =========================

// ---------------------- Helpers ----------------------
const safeGet = (id) => document.getElementById(id) || document.querySelector(`#${id}`);
const showEl = (el) => { if (el) el.style.display = "block"; };
const hideEl = (el) => { if (el) el.style.display = "none"; };
const setHTML = (el, html) => { if (!el) return; el.innerHTML = html; showEl(el); };
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function clampNumber(v, fallback = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}
function nowISO() { return new Date().toISOString(); }

// ---------------------- DOM Ready ----------------------
document.addEventListener("DOMContentLoaded", () => {

    // ---------------- DOM elements ----------------
    const sidebar = safeGet("sidebar");
    const sidebarToggleBtn = safeGet("sidebarToggle");

    const userNameEl = safeGet("userName");
    const userMaatramEl = safeGet("userMaatramId");
    const userPhoneEl = safeGet("userPhone");

    // Question area
    const questionsBox = safeGet("questionsBox") || safeGet("questionBox") || safeGet("questionsContainer");
    const questionText = safeGet("questionText");
    const answerInput = safeGet("answerInput");
    const nextBtn = safeGet("nextBtn");
    const resultBtn = safeGet("resultBtn");

    // Career / action plan
    const careerResultBox = safeGet("careerResultBox");
    const careerResult = safeGet("careerResult");
    const selectCareerBtn = safeGet("selectCareerBtn");

    const actionPlanBox = safeGet("actionPlanBox");
    const actionPlanResult = safeGet("actionPlanResult");

    // File popup / wallet
    const filePopup = safeGet("filePopup");
    const fileList = safeGet("fileList");

    // wallet file upload inputs are .file-upload under .add-btn elements
    const fileUploadInputs = Array.from(document.querySelectorAll(".add-btn input.file-upload"));
    const viewButtons = Array.from(document.querySelectorAll(".view-btn"));

    // ---------------- Sidebar toggle ----------------
    if (sidebar && sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("active");
            document.body.classList.toggle("sidebar-open");
        });
    }

    // ---------------- Load user info (attempt) ----------------
    async function loadUserInfo() {
        try {
            const res = await fetch("/get-user");
            if (!res.ok) return;
            const data = await res.json();
            if (userNameEl) userNameEl.innerText = data.name || "N/A";
            if (userMaatramEl) userMaatramEl.innerText = data.username || "N/A";
            if (userPhoneEl) userPhoneEl.innerText = data.phno || "N/A";
        } catch (err) {
            console.debug("loadUserInfo:", err);
        }
    }
    loadUserInfo();

    // ---------------- State ----------------
    const state = {
        mode: "questions", // questions | career_choice | topic_check | hours_daily | hours_weekly | done
        questions: [
            "What subjects do you enjoy the most?",
            "What hobbies or activities do you like?",
            "Do you prefer working with people, technology, or ideas?",
            "Do you like creative or analytical tasks more?",
            "What are your strengths?",
            "Any career ideas in mind?",
            "Currently pursuing degree/course?"
        ],
        answers: [],
        currentQuestionIndex: 0,
        careerPayload: null,
        chosenCareer: null,
        missingTopics: [],
        knownTopics: [],
        dailyHours: null,
        weeklyHours: null,
        _topicIndex: 0
    };

    // ---------------- LocalStorage Keys ----------------
    const LS = {
        careerHTML: "savedCareerHTML_v2",
        careerPayload: "savedCareerPayload_v2",
        actionPlanHTML: "savedActionPlanHTML_v2",
        actionPlanData: "savedActionPlanData_v2",
        walletFiles: "walletFiles_v2" // stores uploadedFiles metadata + base64 data
    };

    // ---------------- Wallet (uploadedFiles) ----------------
    // Structure in memory:
    // uploadedFiles = { volunteering: [{ name, type, size, dataUrl, uploadedAt }], skills: [...], activity: [...] }
    let uploadedFiles = { volunteering: [], skills: [], activity: [] };

    // Save wallet to localStorage
    function saveUploadedFilesToLocalStorage() {
        try {
            localStorage.setItem(LS.walletFiles, JSON.stringify(uploadedFiles));
        } catch (e) {
            console.debug("saveUploadedFilesToLocalStorage error:", e);
        }
    }

    // Load wallet from localStorage (restore to uploadedFiles)
    function loadUploadedFilesFromLocalStorage() {
        try {
            const raw = localStorage.getItem(LS.walletFiles);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            // Basic validation
            if (typeof parsed === "object" && parsed !== null) {
                uploadedFiles = {
                    volunteering: Array.isArray(parsed.volunteering) ? parsed.volunteering.slice() : [],
                    skills: Array.isArray(parsed.skills) ? parsed.skills.slice() : [],
                    activity: Array.isArray(parsed.activity) ? parsed.activity.slice() : []
                };
            }
        } catch (e) {
            console.debug("loadUploadedFilesFromLocalStorage error:", e);
        }
    }

    // Helper to convert File -> dataURL (returns Promise)
    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // Add a File (from input) into uploadedFiles, persist, and re-render list
    async function handleFileInputChange(fileInput) {
        const type = fileInput.dataset.type;
        if (!type) return;
        if (!fileInput.files?.length) return;

        for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            try {
                // read as dataURL
                const dataUrl = await fileToDataURL(file);
                uploadedFiles[type] ??= [];
                uploadedFiles[type].push({
                    name: file.name,
                    type: file.type || "application/octet-stream",
                    size: file.size || 0,
                    dataUrl,
                    uploadedAt: nowISO()
                });
            } catch (err) {
                console.debug("file read error:", err);
                // fallback: push metadata only (no dataUrl) so user can re-upload later
                uploadedFiles[type] ??= [];
                uploadedFiles[type].push({
                    name: file.name,
                    type: file.type || "application/octet-stream",
                    size: file.size || 0,
                    dataUrl: null,
                    uploadedAt: nowISO()
                });
            }
        }

        // persist and clear input
        saveUploadedFilesToLocalStorage();
        fileInput.value = "";
    }

    // Render file list popup for given type
    function renderFileList(type) {
        const files = uploadedFiles[type] || [];
        if (!filePopup || !fileList) return;
        fileList.innerHTML = "";

        if (!files.length) {
            fileList.innerHTML = `<li>No uploaded files for ${escapeHtml(type)}</li>`;
        } else {
            files.forEach((f, i) => {
                const li = document.createElement("li");
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.padding = "6px 0";

                const left = document.createElement("div");
                left.innerText = `${i+1}. ${f.name} (${Math.round((f.size||0)/1024)} KB)`;

                const controls = document.createElement("div");
                controls.style.display = "flex";
                controls.style.gap = "8px";

                // Open button
                const openBtn = document.createElement("button");
                openBtn.innerText = "Open";
                openBtn.className = "btn-open-file";
                openBtn.style.cssText = "background:#28a745;color:#fff;border:none;padding:6px 8px;border-radius:4px;cursor:pointer";
                openBtn.addEventListener("click", () => {
                    // If we have dataUrl, create blob and open; otherwise alert to re-upload
                    if (f.dataUrl) {
                        try {
                            // dataUrl may be large; create blob from base64
                            const url = f.dataUrl;
                            // open in new tab
                            const w = window.open();
                            if (!w) return alert("Popup blocked — allow popups for this site to view file.");
                            w.document.write(`<iframe src="${url}" style="width:100%;height:100%;border:none;"></iframe>`);
                        } catch (e) {
                            console.debug("open file error:", e);
                            alert("Unable to open file. Try re-uploading.");
                        }
                    } else {
                        alert("This file was saved without content (metadata only). Please re-upload if you want to open it.");
                    }
                });

                // Download button
                const dlBtn = document.createElement("button");
                dlBtn.innerText = "Download";
                dlBtn.className = "btn-download-file";
                dlBtn.style.cssText = "background:#0d6efd;color:#fff;border:none;padding:6px 8px;border-radius:4px;cursor:pointer";
                dlBtn.addEventListener("click", () => {
                    if (!f.dataUrl) return alert("No data saved for this file.");
                    try {
                        // create temporary link to trigger download
                        const link = document.createElement("a");
                        link.href = f.dataUrl;
                        link.download = f.name || `file_${i+1}`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                    } catch (e) {
                        console.debug("download error:", e);
                        alert("Download failed.");
                    }
                });

                // Delete button
                const delBtn = document.createElement("button");
                delBtn.innerText = "Delete";
                delBtn.className = "btn-delete-file";
                delBtn.style.cssText = "background:#ff4d4d;color:#fff;border:none;padding:6px 8px;border-radius:4px;cursor:pointer";
                delBtn.addEventListener("click", () => {
                    if (!confirm(`Delete file ${f.name}?`)) return;
                    uploadedFiles[type].splice(i,1);
                    saveUploadedFilesToLocalStorage();
                    renderFileList(type);
                });

                controls.appendChild(openBtn);
                controls.appendChild(dlBtn);
                controls.appendChild(delBtn);

                li.appendChild(left);
                li.appendChild(controls);
                fileList.appendChild(li);
            });
        }

        // show popup
        showEl(filePopup);
    }

    // Wire file input change listeners (read file and store)
    fileUploadInputs.forEach(input => {
        input.addEventListener("change", async () => {
            await handleFileInputChange(input);
        });
    });
    // Wire view buttons
    viewButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const t = btn.dataset.type;
            renderFileList(t);
        });
    });

    // Close popup logic
    document.addEventListener("click", e => {
        if (e.target?.classList?.contains("close-popup")) {
            const popup = e.target.closest(".popup");
            if (popup) hideEl(popup);
        }
    });

    // ---------------- Save / Restore helpers for career/action plan ----------------
    function saveCareerHTML() {
        try {
            if (careerResult) localStorage.setItem(LS.careerHTML, careerResult.innerHTML);
            if (state.careerPayload) localStorage.setItem(LS.careerPayload, JSON.stringify(state.careerPayload));
        } catch (e) { console.debug("saveCareerHTML:", e); }
    }

    function saveActionPlan(actionPlanObj) {
        try {
            if (actionPlanResult) localStorage.setItem(LS.actionPlanHTML, actionPlanResult.innerHTML);
            if (actionPlanObj) localStorage.setItem(LS.actionPlanData, JSON.stringify(actionPlanObj));
        } catch (e) { console.debug("saveActionPlan:", e); }
    }

    function clearSavedData() {
        try {
            localStorage.removeItem(LS.careerHTML);
            localStorage.removeItem(LS.careerPayload);
            localStorage.removeItem(LS.actionPlanHTML);
            localStorage.removeItem(LS.actionPlanData);
        } catch (e) { console.debug("clearSavedData:", e); }
    }

    // ---------------- Re-run button (right-aligned small blue) ----------------
    let rerunBtn = null;

function createRerunButtonRightAligned() {
    if (!questionsBox) return;
    if (rerunBtn) return; // already created

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "flex-end";
    wrapper.style.width = "100%";
    wrapper.style.marginTop = "8px";

    const btn = document.createElement("button");
    btn.id = "rerunAgentBtn";
    btn.innerText = "Re-run Agent";
    btn.style.padding = "8px 12px";
    btn.style.background = "#007bff";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "600";
    btn.style.fontSize = "13px";
    btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
    btn.title = "Restart the question flow";

    btn.addEventListener("click", () => {
        clearSavedData();      // safe reset (wallet not touched)
        resetToQuestions();    // restart question system
    });

    wrapper.appendChild(btn);
    questionsBox.appendChild(wrapper);
    rerunBtn = btn;
}


    // ---------------- Reset to Questions ----------------
    function resetToQuestions() {
        state.mode = "questions";
        state.answers = [];
        state.currentQuestionIndex = 0;
        state.careerPayload = null;
        state.chosenCareer = null;
        state.missingTopics = [];
        state.knownTopics = [];
        state.dailyHours = null;
        state.weeklyHours = null;
        state._topicIndex = 0;

        if (careerResult) careerResult.innerHTML = "";
        if (actionPlanResult) actionPlanResult.innerHTML = "";
        if (careerResultBox) hideEl(careerResultBox);
        if (actionPlanBox) hideEl(actionPlanBox);
        if (selectCareerBtn) hideEl(selectCareerBtn);

        showQuestion(0);
    }

    // ---------------- Show question ----------------
    function showQuestion(index = 0) {
        if (!questionText || !answerInput) return;
        index = Math.max(0, Math.min(index, state.questions.length - 1));
        state.currentQuestionIndex = index;

        questionText.innerText = state.questions[index] || "";
        answerInput.value = "";
        answerInput.focus();

        if (state.mode === "questions") {
            if (index === state.questions.length - 1) {
                hideEl(nextBtn);
                showEl(resultBtn);
            } else {
                showEl(nextBtn);
                hideEl(resultBtn);
            }
        }

        // create rerun button and ensure visible
        createRerunButtonRightAligned();
        if (rerunBtn) rerunBtn.style.display = "inline-block";
    }

    // ---------------- Handle Next ----------------
    function handleNext() {
        const raw = (answerInput.value || "").trim();

        switch(state.mode) {
            case "questions":
                if (!raw) return alert("Please answer this question!");
                state.answers.push(raw);
                state.currentQuestionIndex++;
                showQuestion(state.currentQuestionIndex);
                break;

            case "career_choice":
                if (!raw) return alert("Please choose 1, 2, or 3");
                const idx = parseInt(raw, 10) - 1;
                const recs = state.careerPayload?.recommendations || [];
                if (idx < 0 || idx >= recs.length) return alert("Invalid choice number");
                state.chosenCareer = recs[idx].career || recs[idx].name || recs[idx];
                answerInput.value = "";
                if (careerResult) {
                    const topHTML = `<div style="margin-bottom:10px;"><strong>🎯 Selected Career:</strong> ${escapeHtml(state.chosenCareer)}</div>`;
                    careerResult.insertAdjacentHTML("afterbegin", topHTML);
                }
                startTopicCheck();
                break;

            case "topic_check":
                if (!raw) return alert("Please answer yes or no");
                const ans = raw.toLowerCase();
                if (!["yes","no","y","n"].includes(ans)) return alert("Answer must be yes/no");
                const topic = state.missingTopics[state._topicIndex];
                if (ans === "yes" || ans === "y") state.knownTopics.push(topic);
                state._topicIndex++;
                updateTopicSummary();
                if (state._topicIndex >= state.missingTopics.length) startHoursDaily();
                else askCurrentTopic();
                break;

            case "hours_daily":
                if (!raw) return alert("Enter hours per day (number)");
                const dailyVal = clampNumber(raw, NaN);
                if (Number.isNaN(dailyVal) || dailyVal < 0) return alert("Invalid number");
                state.dailyHours = dailyVal;
                startHoursWeekly();
                break;

            case "hours_weekly":
                if (!raw) return alert("Enter weekly hours (number)");
                const weeklyVal = clampNumber(raw, NaN);
                if (Number.isNaN(weeklyVal) || weeklyVal < 0) return alert("Invalid number");
                state.weeklyHours = weeklyVal;
                generateAndShowActionPlan();
                break;
        }
    }

    if (nextBtn) nextBtn.addEventListener("click", handleNext);
    if (answerInput) answerInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleNext();
        }
    });

    // ---------------- Result button (send answers) ----------------
    if (resultBtn) {
        resultBtn.addEventListener("click", async () => {
            const ans = (answerInput.value || "").trim();
            if (!ans) return alert("Please answer this question!");
            if (state.answers.length < state.questions.length) state.answers.push(ans);

            if (careerResult) careerResult.innerHTML = "<p>Loading recommendations...</p>";
            if (careerResultBox) showEl(careerResultBox);

            try {
                const res = await fetch("/career-questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ answers: state.answers })
                });
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                const payload = (await res.json()).data || {};

                state.careerPayload = {
                    recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : [],
                    top_career: payload.top_career || "",
                    topics: Array.isArray(payload.topics) ? payload.topics : [],
                    action_plan: payload.action_plan || payload.actionPlan || null
                };

                renderCareerRecommendations();

                // Save recommended career HTML + payload to localStorage
                saveCareerHTML();

                state.mode = "career_choice";
                questionText.innerText = `Which career do you want to choose? (1/${state.careerPayload.recommendations.length}) — type the number and press Enter`;
                answerInput.value = "";
                answerInput.focus();
                showEl(nextBtn);
                hideEl(resultBtn);

                // ensure rerun visible
                createRerunButtonRightAligned();
                if (rerunBtn) rerunBtn.style.display = "inline-block";

            } catch(err) {
                console.error(err);
                if (careerResult) careerResult.innerHTML = `<p style="color:red">Error retrieving career recommendations.</p>`;
            }
        });
    }

    // ---------------- Render Career ----------------
    function renderCareerRecommendations() {
        if (!careerResult || !state.careerPayload) return;
        const recs = state.careerPayload.recommendations || [];
        const topics = state.careerPayload.topics || [];

        let html = `<div style="margin-bottom:8px;"><strong>Top Recommended:</strong> ${escapeHtml(state.careerPayload.top_career || (recs[0]?.career || recs[0]?.name || ""))}</div>`;
        html += `<div id="careerChoices">`;
        recs.forEach((r, idx) => {
            const careerName = r.career || r.name || `Career ${idx+1}`;
            const reason = r.reason || r.desc || r.description || "";
            html += `
                <label style="display:block;margin:10px 0;cursor:pointer;">
                    <input type="radio" name="careerChoice" value="${escapeHtml(careerName)}" ${idx===0?"checked":""}/>
                    <strong style="margin-left:8px">${escapeHtml(careerName)}</strong>
                    <div style="margin-left:28px;font-size:13px;color:#333">${escapeHtml(reason)}</div>
                </label>
            `;
        });
        html += `</div>`;
        if (topics.length) html += `<div style="margin-top:12px;"><strong>Suggested Topics:</strong> ${escapeHtml(topics.join(", "))}</div>`;
        html += `<div style="margin-top:12px;"><small>Type the choice number in the question box (1,2,3) and press Enter.</small></div>`;
        setHTML(careerResult, html);
        if (selectCareerBtn) showEl(selectCareerBtn);

        // attach listeners (if selectCareerBtn exists)
        attachCareerResultListeners();
    }

    // ---------------- Topic check ----------------
    function startTopicCheck() {
        const payload = state.careerPayload || {};
        const payloadTopics = Array.isArray(payload.topics)? payload.topics.slice() : [];
        state.missingTopics = Array.isArray(payload.action_plan?.missing_topics) ? payload.action_plan.missing_topics.slice() : payloadTopics.slice();
        state.knownTopics = [];
        state._topicIndex = 0;
        state.mode = "topic_check";

        if (!state.missingTopics.length) {
            updateTopicSummary();
            startHoursDaily();
        } else {
            askCurrentTopic();
        }
    }

    function askCurrentTopic() {
        const topic = state.missingTopics[state._topicIndex];
        if (!topic) return startHoursDaily();
        questionText.innerText = `Do you already know or have experience with '${topic}'? (yes/no)`;
        answerInput.value = "";
        answerInput.focus();
        showEl(nextBtn);
        hideEl(resultBtn);
    }

    function updateTopicSummary() {
        if (!careerResult) return;
        const known = state.knownTopics;
        const unknown = state.missingTopics.filter(t => !known.includes(t));
        const existing = safeGet("topicSummary");
        if (existing) existing.remove();

        const div = document.createElement("div");
        div.id = "topicSummary";
        div.innerHTML = `<div style="margin-top:10px;"><strong>Known topics:</strong> ${known.length?escapeHtml(known.join(", ")):"None"}<br><strong>Missing topics:</strong> ${unknown.length?escapeHtml(unknown.join(", ")):"None"}</div>`;
        careerResult.appendChild(div);
    }

    // ---------------- Hours ----------------
    function startHoursDaily() {
        state.mode = "hours_daily";
        questionText.innerText = "How many hours can you study per day? (e.g., 2)";
        answerInput.value = "";
        answerInput.focus();
        showEl(nextBtn);
        hideEl(resultBtn);
    }

    function startHoursWeekly() {
        state.mode = "hours_weekly";
        questionText.innerText = "Total weekly study hours? (e.g., 10)";
        answerInput.value = "";
        answerInput.focus();
        showEl(nextBtn);
        hideEl(resultBtn);
    }

    // ---------------- Action Plan helpers ----------------
    function generateDailySchedule(topics,hoursPerDay){
        if(!topics.length) return {};
        const per = +(hoursPerDay/topics.length).toFixed(2);
        const schedule={};
        topics.forEach(t=>schedule[t]=`${per} hours`);
        return {goal:state.chosenCareer,hours_per_day:hoursPerDay,schedule};
    }

    function generateWeeklySchedule(topics,weeklyHours){
        if(!topics.length) return {};
        const perDay = +(weeklyHours/7).toFixed(2);
        const perTopic = +(perDay/topics.length).toFixed(2);
        const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        const schedule={};
        days.forEach(d=>{schedule[d]={};topics.forEach(t=>schedule[d][t]=`${perTopic} hours`);});
        return {goal:state.chosenCareer,weekly_hours:weeklyHours,schedule};
    }

    function generateStarterGuide(missing){
        if(!missing.length) return `You already know the core topics for ${state.chosenCareer}. Focus on projects, portfolio, and advanced practice.`;
        return `Starter 6-12 month guide for ${state.chosenCareer}:\n- Learn: ${missing.join(", ")}\n- Build small projects\n- Create portfolio and apply for internships\n- Network with professionals`;
    }

    function generateAndShowActionPlan(){
        const finalMissing = state.missingTopics.filter(t=>!state.knownTopics.includes(t));
        const daily = generateDailySchedule(finalMissing,state.dailyHours||0);
        const weekly = generateWeeklySchedule(finalMissing,state.weeklyHours||0);
        const starter = generateStarterGuide(finalMissing);

        const actionPlan={
            selected_career:state.chosenCareer,
            missing_topics:finalMissing,
            known_topics:state.knownTopics,
            daily_schedule:daily.schedule,
            weekly_schedule:weekly.schedule,
            starter_guide:starter
        };

        let html = `<h3>Action Plan for ${escapeHtml(state.chosenCareer)}</h3>
            <p><strong>Known topics:</strong> ${state.knownTopics.length?escapeHtml(state.knownTopics.join(", ")):"None"}</p>
            <p><strong>Missing topics:</strong> ${finalMissing.length?escapeHtml(finalMissing.join(", ")):"None"}</p>
            <p><strong>Starter Guide:</strong> <button id="showStarterBtn" class="btn">Show</button></p>
            <div style="margin-top:8px;">
                <button id="showDailyBtn" class="btn">Daily Schedule</button> 
                <button id="showWeeklyBtn" class="btn">Weekly Schedule</button> 
                <button id="updateProgressBtn" class="btn">Update Progress</button> 
                <button id="showGraphBtn" class="btn">Show Progress Graph</button>
            </div>
            <div id="actionPlanDetail" style="margin-top:12px;"></div>`;

        setHTML(actionPlanResult,html);
        showEl(actionPlanBox);

        // attach listeners for the newly created buttons
        attachActionPlanListeners(actionPlan);

        // persist action plan HTML + data
        saveActionPlan(actionPlan);

        // ensure rerun visible
        if (rerunBtn) rerunBtn.style.display = "inline-block";

        state.mode="done";
    }

    // ---------------- Attach action plan listeners (works on fresh creation & on restore) ----------------
    function attachActionPlanListeners(actionPlanObj) {
        const detail = safeGet("actionPlanDetail");

        // remove prior listeners by replacing nodes (defensive)
        const replaceIfExists = (id) => {
            const el = safeGet(id);
            if (!el) return null;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            return newEl;
        };

        const starterBtn = replaceIfExists("showStarterBtn") || safeGet("showStarterBtn");
        const dailyBtn = replaceIfExists("showDailyBtn") || safeGet("showDailyBtn");
        const weeklyBtn = replaceIfExists("showWeeklyBtn") || safeGet("showWeeklyBtn");
        const updateBtn = replaceIfExists("updateProgressBtn") || safeGet("updateProgressBtn");
        const graphBtn = replaceIfExists("showGraphBtn") || safeGet("showGraphBtn");

        // show starter
        if (starterBtn) starterBtn.addEventListener("click", () => {
            if (!detail) return;
            detail.innerHTML = `<pre>${escapeHtml(actionPlanObj?.starter_guide || "")}</pre>`;
            detail.style.display = "block";
        });

        // show daily
        if (dailyBtn) dailyBtn.addEventListener("click", () => {
            if (!detail) return;
            detail.innerHTML = `<pre>${escapeHtml(JSON.stringify(actionPlanObj?.daily_schedule || {}, null, 2))}</pre>`;
            detail.style.display = "block";
        });

        // show weekly
        if (weeklyBtn) weeklyBtn.addEventListener("click", () => {
            if (!detail) return;
            detail.innerHTML = `<pre>${escapeHtml(JSON.stringify(actionPlanObj?.weekly_schedule || {}, null, 2))}</pre>`;
            detail.style.display = "block";
        });

        // update progress
        if (updateBtn) updateBtn.addEventListener("click", () => {
            const topic = prompt("Enter topic to update progress for:");
            const pct = prompt("Enter completion % (0-100):");
            if (!topic || !pct) return;
            fetch("/update-progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, percentage: parseInt(pct) })
            })
            .then(r=>r.json())
            .then(res=>res.success?alert(`Progress updated: ${topic} = ${pct}%`):alert("Failed to update progress"))
            .catch(()=>alert("Update failed"));
        });

        // show graph
        if (graphBtn) graphBtn.addEventListener("click", () => window.open("/progress-graph","_blank"));

        // Note: rerun button remains in question box, not re-created here
    }

    // ---------------- Career result listeners (select career) ----------------
    function attachCareerResultListeners() {
        if (!selectCareerBtn) return;
        selectCareerBtn.removeEventListener("click", onSelectCareerClick);
        selectCareerBtn.addEventListener("click", onSelectCareerClick);
    }
    function onSelectCareerClick() {
        const checked = document.querySelector('input[name="careerChoice"]:checked');
        if (checked) {
            const chosen = checked.value;
            state.chosenCareer = chosen;
            if (careerResult) {
                const topHTML = `<div style="margin-bottom:10px;"><strong>🎯 Selected Career:</strong> ${escapeHtml(state.chosenCareer)}</div>`;
                careerResult.insertAdjacentHTML("afterbegin", topHTML);
            }
            startTopicCheck();
        } else {
            alert("Please select a career option.");
        }
    }

    // attach now if selectCareerBtn exists
    attachCareerResultListeners();

    // ---------------- Restore saved HTML + wallet on load ----------------
    (function tryRestoreFromLocalStorage() {
        try {
            // restore wallet files first
            loadUploadedFilesFromLocalStorage();

            // restore career & action plan
            const savedCareerHTML = localStorage.getItem(LS.careerHTML);
            const savedCareerPayload = localStorage.getItem(LS.careerPayload);
            const savedActionPlanHTML = localStorage.getItem(LS.actionPlanHTML);
            const savedActionPlanData = localStorage.getItem(LS.actionPlanData);

            let restoredActionPlanObj = null;

            if (savedCareerHTML) {
                if (careerResult) {
                    careerResult.innerHTML = savedCareerHTML;
                    showEl(careerResultBox);
                }
                if (savedCareerPayload) {
                    try { state.careerPayload = JSON.parse(savedCareerPayload); } catch(e){ console.debug(e); }
                }
            }

            if (savedActionPlanHTML) {
                if (actionPlanResult) {
                    actionPlanResult.innerHTML = savedActionPlanHTML;
                    showEl(actionPlanBox);
                }
                if (savedActionPlanData) {
                    try { restoredActionPlanObj = JSON.parse(savedActionPlanData); } catch(e){ console.debug(e); }
                }
            }

            // If restored action plan, re-attach its listeners using the saved data
            if (restoredActionPlanObj) {
                // attach listeners to the restored DOM buttons
                attachActionPlanListeners(restoredActionPlanObj);
            }

            // Ensure career result radio/select listeners work after restore
            attachCareerResultListeners();

            // If either saved career or action plan found, set state to done
            if (savedCareerHTML || savedActionPlanHTML) {
                state.mode = "done";
            } else {
                resetToQuestions();
            }

        } catch (e) {
            console.debug("restore error:", e);
            resetToQuestions();
        }
    })();

    // ---------------- Sidebar & form helpers ----------------
    const submitBtn = document.querySelector(".submit-btn");
    if(submitBtn && sidebar) submitBtn.addEventListener("click",()=>{
        sidebar.classList.remove("active");
        document.body.classList.remove("sidebar-open");
        alert("Profile submitted!");
    });
    const profileForm = safeGet("profileForm");
    if(profileForm) profileForm.addEventListener("submit", e=>e.preventDefault());
    const phoneInput = safeGet("phoneNumber");
    const whatsappInput = safeGet("whatsappNumber");
    const sameWhatsapp = safeGet("sameWhatsapp");
    if(sameWhatsapp && phoneInput && whatsappInput) {
        sameWhatsapp.addEventListener("change",()=>{
            if(sameWhatsapp.checked) whatsappInput.value=phoneInput.value;
        });
    }

    // ---------------- Initialization final steps ----------------
    // ensure rerun exists and visible (C behavior)
    createRerunButtonRightAligned();
    if (rerunBtn) rerunBtn.style.display = "inline-block";

    // render: if wallet had files and user wants to view, they will click "View"
    // otherwise start the question flow if not already in done state
    if (state.mode !== "done") showQuestion(0);

    // expose debug state for convenience
    window.__carpre_state = state;
    window.__carpre_uploadedFiles = uploadedFiles;

}); // DOMContentLoaded end
