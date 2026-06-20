/* ==========================================================================
   Creative Class Seat Picker - Core Application JS
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Audio Synthesizer (Web Audio API)
// --------------------------------------------------------------------------
const SoundSynth = {
  ctx: null,
  enabled: true,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTick(frequency = 800, duration = 0.04) {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  },

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  },

  playReveal() {
    if (!this.enabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  },

  playFanfare() {
    if (!this.enabled) return;
    this.init();
    try {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major scale arpeggio
      notes.forEach((freq, index) => {
        const startTime = this.ctx.currentTime + index * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }
};

// --------------------------------------------------------------------------
// 2. Application State & Storage
// --------------------------------------------------------------------------
const AppState = {
  students: [],
  rows: 5,
  cols: 6,
  gridLayout: {}, // Key: "r,c" -> Value: "active" | "inactive"
  frontStudents: [],
  banPairs: [],
  selectedMode: 'roulette',
  audioEnabled: true,
  currentTheme: 'dark', // 'dark' | 'projector'

  // Final solution
  assignment: null, // { seatMap, studentAtSeat }

  load() {
    try {
      const saved = localStorage.getItem('class_seat_picker_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.students = parsed.students || [];
        this.rows = parsed.rows || 5;
        this.cols = parsed.cols || 6;
        this.gridLayout = parsed.gridLayout || {};
        this.frontStudents = parsed.frontStudents || [];
        this.banPairs = parsed.banPairs || [];
        this.selectedMode = parsed.selectedMode || 'roulette';
        this.audioEnabled = parsed.audioEnabled !== false;
        this.currentTheme = parsed.currentTheme || 'dark';
      } else {
        // Default layout
        this.resetGridLayout();
      }
    } catch (e) {
      console.error("LocalStorage load error:", e);
      this.resetGridLayout();
    }
  },

  save() {
    try {
      const data = {
        students: this.students,
        rows: this.rows,
        cols: this.cols,
        gridLayout: this.gridLayout,
        frontStudents: this.frontStudents,
        banPairs: this.banPairs,
        selectedMode: this.selectedMode,
        audioEnabled: this.audioEnabled,
        currentTheme: this.currentTheme
      };
      localStorage.setItem('class_seat_picker_data', JSON.stringify(data));
    } catch (e) {
      console.error("LocalStorage save error:", e);
    }
  },

  resetGridLayout() {
    this.gridLayout = {};
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.gridLayout[`${r},${c}`] = 'active';
      }
    }
  }
};

// Sample Names List
const SAMPLE_NAMES = [
  "김도윤", "이서준", "박하준", "최은우", "정서진", "강민재", "조서아", "윤이서", 
  "장아윤", "임지아", "한하윤", "오민서", "서채원", "신하은", "권지우", "황지아", 
  "송은지", "안수아", "전우진", "홍예준", "유하랑", "양시우", "고다은", "문지유"
];

// --------------------------------------------------------------------------
// 3. Constraint Solver Algorithm
// --------------------------------------------------------------------------
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}


function solveSeatAssignment() {
  const activeSeats = [];
  for (let r = 0; r < AppState.rows; r++) {
    for (let c = 0; c < AppState.cols; c++) {
      if (AppState.gridLayout[`${r},${c}`] !== 'inactive') {
        activeSeats.push({ r, c, key: `${r},${c}` });
      }
    }
  }

  if (activeSeats.length < AppState.students.length) {
    throw new Error(`자리가 부족합니다!\n배치할 학생: ${AppState.students.length}명, 사용 가능 좌석: ${activeSeats.length}개\n교실 구조에서 좌석 개수를 확인해 주세요.`);
  }

  // Sort seats: Row ascending, then Col ascending (front to back)
  activeSeats.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });

  // Extract front students
  const frontSet = new Set(AppState.frontStudents);
  const fronts = AppState.students.filter(name => frontSet.has(name));
  const regulars = AppState.students.filter(name => !frontSet.has(name));

  let attempts = 0;
  let solution = null;

  while (attempts < 1000) {
    attempts++;
    
    // Copy active seats
    const seats = [...activeSeats];

    const seatMap = {}; // name -> seat {r, c, key}
    const studentAtSeat = {}; // key -> name

    // Shuffle both student pools
    const shuffledFronts = shuffleArray(fronts);
    const shuffledRegulars = shuffleArray(regulars);

    // Assign front students to first K seats
    let validAssign = true;
    for (let i = 0; i < shuffledFronts.length; i++) {
      const student = shuffledFronts[i];
      const seat = seats[i];
      seatMap[student] = seat;
      studentAtSeat[seat.key] = student;
    }

    // Remaining seats for regular students
    const remainingSeats = seats.slice(shuffledFronts.length);
    const shuffledRemainingSeats = shuffleArray(remainingSeats);

    for (let i = 0; i < shuffledRegulars.length; i++) {
      const student = shuffledRegulars[i];
      const seat = shuffledRemainingSeats[i];
      seatMap[student] = seat;
      studentAtSeat[seat.key] = student;
    }

    // Validate Ban Pairs
    let violated = false;
    for (const pair of AppState.banPairs) {
      const seat1 = seatMap[pair.s1];
      const seat2 = seatMap[pair.s2];
      
      if (!seat1 || !seat2) continue; // Skip if one student is missing

      // Check direct horizontal / vertical adjacency
      const dist = Math.abs(seat1.r - seat2.r) + Math.abs(seat1.c - seat2.c);
      if (dist === 1) {
        violated = true;
        break;
      }
    }

    if (!violated) {
      solution = { seatMap, studentAtSeat, constraintWarning: false };
      break;
    }
  }

  // Fallback: Constraints relaxation if no solution found in 1000 steps
  if (!solution) {
    console.warn("No perfect arrangement satisfying all conditions found. Relaxing constraints.");
    const seats = [...activeSeats];
    const seatMap = {};
    const studentAtSeat = {};
    
    // Just force place front row first, then place others randomly
    const shuffledFronts = shuffleArray(fronts);
    const shuffledRegulars = shuffleArray(regulars);
    
    for (let i = 0; i < shuffledFronts.length; i++) {
      const student = shuffledFronts[i];
      const seat = seats[i];
      seatMap[student] = seat;
      studentAtSeat[seat.key] = student;
    }

    const remainingSeats = seats.slice(shuffledFronts.length);
    const shuffledRemainingSeats = shuffleArray(remainingSeats);

    for (let i = 0; i < shuffledRegulars.length; i++) {
      const student = shuffledRegulars[i];
      const seat = shuffledRemainingSeats[i];
      seatMap[student] = seat;
      studentAtSeat[seat.key] = student;
    }

    solution = { seatMap, studentAtSeat, constraintWarning: true };
  }

  return solution;
}

// --------------------------------------------------------------------------
// 4. UI Manager / Orchestration
// --------------------------------------------------------------------------
const UIManager = {
  // Elements
  views: {
    setup: document.getElementById('view-setup'),
    play: document.getElementById('view-play'),
    result: document.getElementById('view-result')
  },
  inputs: {
    studentsTextarea: document.getElementById('input-students'),
    rowsInput: document.getElementById('grid-rows'),
    colsInput: document.getElementById('grid-cols'),
    fileInput: document.getElementById('input-file-students')
  },
  buttons: {
    soundToggle: document.getElementById('btn-sound-toggle'),
    themeToggle: document.getElementById('btn-theme-toggle'),
    clearStudents: document.getElementById('btn-clear-students'),
    sampleStudents: document.getElementById('btn-sample-students'),
    uploadFile: document.getElementById('btn-upload-file'),
    startDraw: document.getElementById('btn-start-draw'),
    stopDraw: document.getElementById('btn-stop-draw'),
    skipDraw: document.getElementById('btn-skip-draw'),
    restart: document.getElementById('btn-restart'),
    reshuffle: document.getElementById('btn-reshuffle'),
    downloadImg: document.getElementById('btn-download-img'),
    print: document.getElementById('btn-print'),
    addFront: document.getElementById('btn-add-front-student'),
    addBan: document.getElementById('btn-add-ban-pair'),
    rowMinus: document.getElementById('btn-row-minus'),
    rowPlus: document.getElementById('btn-row-plus'),
    colMinus: document.getElementById('btn-col-minus'),
    colPlus: document.getElementById('btn-col-plus')
  },
  displays: {
    studentCount: document.getElementById('student-count'),
    frontList: document.getElementById('front-students-list'),
    banList: document.getElementById('ban-pairs-list'),
    gridEditor: document.getElementById('grid-editor-container'),
    playGrid: document.getElementById('play-grid-container'),
    resultGrid: document.getElementById('result-grid-container'),
    playStatus: document.getElementById('play-status-message'),
    printDate: document.getElementById('print-date')
  },
  overlays: {
    roulette: document.getElementById('overlay-roulette'),
    bomb: document.getElementById('overlay-bomb')
  },
  modals: {
    front: document.getElementById('modal-front'),
    ban: document.getElementById('modal-ban')
  },

  // Drawing animation variables
  activeAnimationTimeouts: [],
  isCancelled: false,
  isSkipped: false,
  revealedCount: 0,
  totalToReveal: 0,

  init() {
    this.registerEvents();
    this.loadStateToUI();
    this.renderGridEditor();
    this.updateStudentCount();
    this.renderFrontBadges();
    this.renderBanBadges();
    lucide.createIcons();
  },

  registerEvents() {
    // Sound Toggle
    this.buttons.soundToggle.addEventListener('click', () => {
      AppState.audioEnabled = !AppState.audioEnabled;
      SoundSynth.enabled = AppState.audioEnabled;
      this.updateSoundButton();
      AppState.save();
    });

    // Theme Toggle
    this.buttons.themeToggle.addEventListener('click', () => {
      if (AppState.currentTheme === 'dark') {
        AppState.currentTheme = 'projector';
      } else {
        AppState.currentTheme = 'dark';
      }
      this.applyTheme();
      AppState.save();
    });

    // Student Text Input
    this.inputs.studentsTextarea.addEventListener('input', () => {
      this.syncStudentsFromInput();
      this.updateStudentCount();
      AppState.save();
    });

    // Clear / Sample
    this.buttons.clearStudents.addEventListener('click', () => {
      this.inputs.studentsTextarea.value = '';
      AppState.students = [];
      AppState.frontStudents = [];
      AppState.banPairs = [];
      this.updateStudentCount();
      this.renderFrontBadges();
      this.renderBanBadges();
      AppState.save();
    });

    this.buttons.sampleStudents.addEventListener('click', () => {
      this.inputs.studentsTextarea.value = SAMPLE_NAMES.join('\n');
      this.syncStudentsFromInput();
      this.updateStudentCount();
      AppState.save();
    });

    // File Upload Trigger
    this.buttons.uploadFile.addEventListener('click', () => {
      this.inputs.fileInput.click();
    });

    // File Selection Handler
    this.inputs.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        // Parse names: split by newlines, commas, or semi-colons
        let names = text.split(/[\r\n,;]+/)
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        // Remove header if it matches common naming columns
        const headerTerms = ['이름', 'name', '학생', 'student'];
        if (names.length > 0 && headerTerms.includes(names[0].toLowerCase())) {
          names.shift();
        }

        if (names.length === 0) {
          alert("파일에서 유효한 학생 이름을 찾을 수 없습니다.");
          return;
        }

        this.inputs.studentsTextarea.value = names.join('\n');
        this.syncStudentsFromInput();
        this.updateStudentCount();
        
        // Reset constraints because student list has changed
        AppState.frontStudents = [];
        AppState.banPairs = [];
        this.renderFrontBadges();
        this.renderBanBadges();
        
        AppState.save();
        SoundSynth.playReveal();

        // Clear files selection
        this.inputs.fileInput.value = '';
      };
      
      reader.onerror = () => {
        alert("파일을 읽는 도중 오류가 발생했습니다.");
      };

      reader.readAsText(file);
    });

    // Rows Spinner
    this.buttons.rowMinus.addEventListener('click', () => this.adjustGridSize('rows', -1));
    this.buttons.rowPlus.addEventListener('click', () => this.adjustGridSize('rows', 1));
    
    // Cols Spinner
    this.buttons.colMinus.addEventListener('click', () => this.adjustGridSize('cols', -1));
    this.buttons.colPlus.addEventListener('click', () => this.adjustGridSize('cols', 1));

    // Mode Selector Cards
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        AppState.selectedMode = card.getAttribute('data-mode');
        AppState.save();
      });
    });

    // Add Constraint Modals
    this.buttons.addFront.addEventListener('click', () => this.openFrontModal());
    this.buttons.addBan.addEventListener('click', () => this.openBanModal());

    // Modal Actions
    document.getElementById('btn-modal-front-cancel').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-modal-front-save').addEventListener('click', () => this.saveFrontModal());

    document.getElementById('btn-modal-ban-cancel').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-modal-ban-add').addEventListener('click', () => this.addBanPairFromModal());

    // Core Drawing Buttons
    this.buttons.startDraw.addEventListener('click', () => this.startDrawingOrchestrator());
    this.buttons.stopDraw.addEventListener('click', () => this.cancelDrawing());
    this.buttons.skipDraw.addEventListener('click', () => {
      this.isSkipped = true;
      SoundSynth.playTick(1200, 0.1);
    });

    // Results Actions
    this.buttons.restart.addEventListener('click', () => this.showView('setup'));
    this.buttons.reshuffle.addEventListener('click', () => this.startDrawingOrchestrator());
    this.buttons.downloadImg.addEventListener('click', () => this.downloadPNG());
    this.buttons.print.addEventListener('click', () => {
      this.displays.printDate.textContent = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      window.print();
    });
  },

  loadStateToUI() {
    AppState.load();
    this.inputs.studentsTextarea.value = AppState.students.join('\n');
    this.inputs.rowsInput.value = AppState.rows;
    this.inputs.colsInput.value = AppState.cols;
    
    // Set Active Drawing Mode Card
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`.mode-card[data-mode="${AppState.selectedMode}"]`);
    if (activeCard) activeCard.classList.add('active');

    // Configure Audio & Theme
    SoundSynth.enabled = AppState.audioEnabled;
    this.updateSoundButton();
    this.applyTheme();
  },

  updateSoundButton() {
    const icon = this.buttons.soundToggle.querySelector('i');
    if (AppState.audioEnabled) {
      icon.setAttribute('data-lucide', 'volume-2');
      this.buttons.soundToggle.classList.remove('muted');
    } else {
      icon.setAttribute('data-lucide', 'volume-x');
      this.buttons.soundToggle.classList.add('muted');
    }
    lucide.createIcons();
  },

  applyTheme() {
    document.body.className = '';
    const icon = this.buttons.themeToggle.querySelector('i');
    if (AppState.currentTheme === 'projector') {
      document.body.classList.add('projector-theme');
      icon.setAttribute('data-lucide', 'moon');
    } else {
      document.body.classList.add('dark-theme');
      icon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
  },

  syncStudentsFromInput() {
    const raw = this.inputs.studentsTextarea.value;
    AppState.students = raw.split(/[\n,]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  },

  updateStudentCount() {
    this.displays.studentCount.textContent = AppState.students.length;
  },

  adjustGridSize(type, delta) {
    if (type === 'rows') {
      const newVal = Math.max(2, Math.min(10, AppState.rows + delta));
      if (newVal !== AppState.rows) {
        AppState.rows = newVal;
        this.inputs.rowsInput.value = newVal;
        AppState.resetGridLayout();
        this.renderGridEditor();
        AppState.save();
      }
    } else {
      const newVal = Math.max(2, Math.min(10, AppState.cols + delta));
      if (newVal !== AppState.cols) {
        AppState.cols = newVal;
        this.inputs.colsInput.value = newVal;
        AppState.resetGridLayout();
        this.renderGridEditor();
        AppState.save();
      }
    }
  },

  // --------------------------------------------------------------------------
  // Grid Editor rendering
  // --------------------------------------------------------------------------
  renderGridEditor() {
    const container = this.displays.gridEditor;
    container.innerHTML = '';
    container.style.gridTemplateRows = `repeat(${AppState.rows}, 1fr)`;
    container.style.gridTemplateColumns = `repeat(${AppState.cols}, 1fr)`;

    for (let r = 0; r < AppState.rows; r++) {
      for (let c = 0; c < AppState.cols; c++) {
        const key = `${r},${c}`;
        const state = AppState.gridLayout[key] || 'active';
        
        const cell = document.createElement('div');
        cell.className = `editor-cell ${state === 'inactive' ? 'cell-inactive' : ''}`;
        cell.textContent = `R${r+1} C${c+1}`;
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener('click', () => {
          const currentState = AppState.gridLayout[key] || 'active';
          const newState = currentState === 'active' ? 'inactive' : 'active';
          AppState.gridLayout[key] = newState;
          
          if (newState === 'inactive') {
            cell.classList.add('cell-inactive');
          } else {
            cell.classList.remove('cell-inactive');
          }
          SoundSynth.playTick(600, 0.03);
          AppState.save();
        });

        container.appendChild(cell);
      }
    }
  },

  // --------------------------------------------------------------------------
  // Constraints badges rendering
  // --------------------------------------------------------------------------
  renderFrontBadges() {
    const container = this.displays.frontList;
    container.innerHTML = '';
    
    // Clean up students who might have been removed from the text list
    AppState.frontStudents = AppState.frontStudents.filter(name => AppState.students.includes(name));

    if (AppState.frontStudents.length === 0) {
      container.innerHTML = '<span class="text-muted" style="font-size: 0.75rem;">지정된 학생 없음</span>';
      return;
    }

    AppState.frontStudents.forEach(name => {
      const badge = document.createElement('span');
      badge.className = 'badge badge-front';
      badge.innerHTML = `${name} <button class="badge-remove">&times;</button>`;
      
      badge.querySelector('.badge-remove').addEventListener('click', () => {
        AppState.frontStudents = AppState.frontStudents.filter(s => s !== name);
        this.renderFrontBadges();
        AppState.save();
        SoundSynth.playTick(400, 0.05);
      });
      container.appendChild(badge);
    });
  },

  renderBanBadges() {
    const container = this.displays.banList;
    container.innerHTML = '';

    // Clean up ban pairs where students are no longer present
    AppState.banPairs = AppState.banPairs.filter(pair => {
      return AppState.students.includes(pair.s1) && AppState.students.includes(pair.s2);
    });

    if (AppState.banPairs.length === 0) {
      container.innerHTML = '<span class="text-muted" style="font-size: 0.75rem;">지정된 커플 없음</span>';
      return;
    }

    AppState.banPairs.forEach((pair, idx) => {
      const badge = document.createElement('span');
      badge.className = 'badge badge-ban';
      badge.innerHTML = `${pair.s1} ↔ ${pair.s2} <button class="badge-remove">&times;</button>`;
      
      badge.querySelector('.badge-remove').addEventListener('click', () => {
        AppState.banPairs.splice(idx, 1);
        this.renderBanBadges();
        AppState.save();
        SoundSynth.playTick(400, 0.05);
      });
      container.appendChild(badge);
    });
  },

  // --------------------------------------------------------------------------
  // Modals management
  // --------------------------------------------------------------------------
  closeModals() {
    this.modals.front.classList.remove('active');
    this.modals.ban.classList.remove('active');
  },

  openFrontModal() {
    this.syncStudentsFromInput();
    if (AppState.students.length === 0) {
      alert("먼저 학생 명단을 등록해 주세요.");
      return;
    }

    const container = document.getElementById('modal-front-checkboxes');
    container.innerHTML = '';

    AppState.students.forEach(name => {
      const isChecked = AppState.frontStudents.includes(name);
      const label = document.createElement('label');
      label.className = 'check-item';
      label.innerHTML = `<input type="checkbox" value="${name}" ${isChecked ? 'checked' : ''}> ${name}`;
      container.appendChild(label);
    });

    this.modals.front.classList.add('active');
  },

  saveFrontModal() {
    const checked = Array.from(document.querySelectorAll('#modal-front-checkboxes input:checked'))
      .map(input => input.value);
    
    AppState.frontStudents = checked;
    this.renderFrontBadges();
    this.closeModals();
    AppState.save();
    SoundSynth.playTick(900, 0.08);
  },

  openBanModal() {
    this.syncStudentsFromInput();
    if (AppState.students.length < 2) {
      alert("금지 짝꿍을 설정하려면 최소 2명 이상의 학생이 필요합니다.");
      return;
    }

    const s1 = document.getElementById('select-ban-student1');
    const s2 = document.getElementById('select-ban-student2');
    
    s1.innerHTML = '<option value="">선택...</option>';
    s2.innerHTML = '<option value="">선택...</option>';

    AppState.students.forEach(name => {
      const opt1 = document.createElement('option');
      opt1.value = name;
      opt1.textContent = name;
      s1.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = name;
      opt2.textContent = name;
      s2.appendChild(opt2);
    });

    this.modals.ban.classList.add('active');
  },

  addBanPairFromModal() {
    const val1 = document.getElementById('select-ban-student1').value;
    const val2 = document.getElementById('select-ban-student2').value;

    if (!val1 || !val2) {
      alert("두 학생 모두 선택해 주세요.");
      return;
    }

    if (val1 === val2) {
      alert("동일한 학생을 고를 수 없습니다.");
      return;
    }

    // Check duplicate
    const exists = AppState.banPairs.some(pair => {
      return (pair.s1 === val1 && pair.s2 === val2) || (pair.s1 === val2 && pair.s2 === val1);
    });

    if (exists) {
      alert("이미 금지 짝꿍으로 등록된 커플입니다.");
      return;
    }

    AppState.banPairs.push({ s1: val1, s2: val2 });
    this.renderBanBadges();
    this.closeModals();
    AppState.save();
    SoundSynth.playFanfare(); // Short ding
  },

  // --------------------------------------------------------------------------
  // Core Drawing Orchestrator
  // --------------------------------------------------------------------------
  showView(viewName) {
    Object.keys(this.views).forEach(key => {
      if (key === viewName) {
        this.views[key].classList.add('active');
      } else {
        this.views[key].classList.remove('active');
      }
    });
  },

  async startDrawingOrchestrator() {
    this.syncStudentsFromInput();
    
    if (AppState.students.length === 0) {
      alert("배치할 학생 이름이 존재하지 않습니다.");
      return;
    }

    // Compute constraints layout
    try {
      AppState.assignment = solveSeatAssignment();
    } catch (err) {
      alert(err.message);
      return;
    }

    // Initialize state
    this.isCancelled = false;
    this.isSkipped = false;
    this.activeAnimationTimeouts = [];

    // Clear display overlays
    Object.values(this.overlays).forEach(el => el.classList.add('hidden'));

    // Render classrooms layouts
    this.renderPlayGrid();
    this.showView('play');

    // Run animations based on selected mode
    if (AppState.selectedMode === 'roulette') {
      await this.runRouletteAnimation();
    } else if (AppState.selectedMode === 'box') {
      await this.runSecretBoxMode();
    } else if (AppState.selectedMode === 'instant') {
      await this.runInstantAnimation();
    } else if (AppState.selectedMode === 'bomb') {
      await this.runBombAnimation();
    }
  },

  cancelDrawing() {
    this.isCancelled = true;
    this.activeAnimationTimeouts.forEach(t => clearTimeout(t));
    this.showView('setup');
    SoundSynth.playTick(300, 0.15);
  },

  async delay(ms) {
    if (this.isSkipped) return Promise.resolve();
    return new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      this.activeAnimationTimeouts.push(t);
    });
  },

  // Grid generator helper for play/results views
  generateClassroomGridElements(container, isInteractiveBox = false) {
    container.innerHTML = '';
    container.style.gridTemplateRows = `repeat(${AppState.rows}, 1fr)`;
    container.style.gridTemplateColumns = `repeat(${AppState.cols}, 1fr)`;

    const nodes = {};

    for (let r = 0; r < AppState.rows; r++) {
      for (let c = 0; c < AppState.cols; c++) {
        const key = `${r},${c}`;
        const isInactive = AppState.gridLayout[key] === 'inactive';
        
        const node = document.createElement('div');
        node.className = `seat-node ${isInactive ? 'seat-inactive' : ''}`;
        
        if (!isInactive) {
          const indexSpan = document.createElement('span');
          indexSpan.className = 'seat-index';
          indexSpan.textContent = `[${r+1}-${c+1}]`;
          node.appendChild(indexSpan);

          const nameSpan = document.createElement('span');
          nameSpan.className = 'student-name';
          node.appendChild(nameSpan);

          if (isInteractiveBox) {
            node.classList.add('seat-box');
            
            const boxIcon = document.createElement('span');
            boxIcon.className = 'box-symbol';
            boxIcon.textContent = '📦';
            node.appendChild(boxIcon);
          }
        }

        container.appendChild(node);
        nodes[key] = node;
      }
    }

    return nodes;
  },

  renderPlayGrid() {
    const isBox = (AppState.selectedMode === 'box');
    this.playGridNodes = this.generateClassroomGridElements(this.displays.playGrid, isBox);
  },

  renderResultGrid() {
    const resultNodes = this.generateClassroomGridElements(this.displays.resultGrid, false);
    
    // Fill result names
    Object.keys(resultNodes).forEach(key => {
      const node = resultNodes[key];
      const studentName = AppState.assignment.studentAtSeat[key];
      if (studentName) {
        node.classList.add('seat-drawn');
        node.querySelector('.student-name').textContent = studentName;
      }
    });

    if (AppState.assignment.constraintWarning) {
      const warningTitle = document.querySelector('.result-header p');
      warningTitle.innerHTML = '⚠️ <strong>주의:</strong> 모든 제약 조건을 완화하여 자리를 무작위로 강제 배치했습니다.';
      warningTitle.style.color = 'var(--color-pink)';
    } else {
      const warningTitle = document.querySelector('.result-header p');
      warningTitle.textContent = '모든 학생들의 자리가 창의적으로 매칭되었습니다.';
      warningTitle.style.color = 'var(--text-secondary)';
    }
  },

  finalizeDrawing() {
    this.renderResultGrid();
    this.showView('result');
    
    // Confetti pop!
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });

    SoundSynth.playFanfare();
  },

  // --------------------------------------------------------------------------
  // 🎰 1. Roulette Animation Mode
  // --------------------------------------------------------------------------
  async runRouletteAnimation() {
    this.displays.playStatus.textContent = '🎰 각 자리의 룰렛 당첨자를 선정하는 중...';
    
    // Find all active seat keys in order
    const seatKeys = Object.keys(this.playGridNodes).filter(key => {
      return AppState.gridLayout[key] !== 'inactive';
    });

    // Filter students actually placed
    const studentsList = AppState.students;

    for (let i = 0; i < seatKeys.length; i++) {
      if (this.isCancelled) return;
      
      const key = seatKeys[i];
      const targetStudent = AppState.assignment.studentAtSeat[key];

      // If no student at this seat (more seats than students), skip
      if (!targetStudent) continue;

      if (this.isSkipped) {
        this.playGridNodes[key].classList.add('seat-drawn');
        this.playGridNodes[key].querySelector('.student-name').textContent = targetStudent;
        continue;
      }

      // Highlight cell in grid
      const seatNode = this.playGridNodes[key];
      seatNode.classList.add('seat-animating');

      // Configure Overlay Ticker
      const r = parseInt(key.split(',')[0]) + 1;
      const c = parseInt(key.split(',')[1]) + 1;
      document.getElementById('roulette-seat-target').textContent = `배치 중인 자리: [${r}행 ${c}열]`;
      this.overlays.roulette.classList.remove('hidden');

      // Create ticker strip items
      const strip = document.getElementById('roulette-strip');
      strip.innerHTML = '';

      // We want to scroll past ~15 names and land on targetStudent
      const tickerNames = [];
      for (let k = 0; k < 15; k++) {
        const randName = studentsList[Math.floor(Math.random() * studentsList.length)];
        tickerNames.push(randName);
      }
      tickerNames.push(targetStudent); // The target lands here

      tickerNames.forEach(name => {
        const nameCard = document.createElement('div');
        nameCard.className = 'roulette-name-card';
        nameCard.textContent = name;
        strip.appendChild(nameCard);
      });

      // Ticker visual scroll animation via transitions
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0px)';
      
      // Force repaint
      strip.offsetWidth;

      // Final offset calculation
      const cardWidth = 120; // width + border
      const stopOffset = -(tickerNames.length - 2) * cardWidth; // align center

      // Start transition
      strip.style.transition = 'transform 2.2s cubic-bezier(0.1, 0.8, 0.2, 1)';
      strip.style.transform = `translateX(${stopOffset + 100}px)`; // offset for center indicator

      // Play tick sounds as it decelerates
      let tickTime = 60;
      for (let step = 0; step < 14; step++) {
        if (this.isCancelled || this.isSkipped) break;
        await this.delay(tickTime);
        SoundSynth.playTick(900 - step * 30, 0.03);
        tickTime += step * 16; // gradual deceleration
      }

      await this.delay(600);

      if (this.isCancelled) return;

      // Flash & sound on finish
      SoundSynth.playReveal();
      
      // Trigger tiny local confetti on the node
      const rect = seatNode.getBoundingClientRect();
      confetti({
        particleCount: 20,
        angle: 90,
        spread: 45,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight
        }
      });

      // Update seat status
      this.overlays.roulette.classList.add('hidden');
      seatNode.classList.remove('seat-animating');
      seatNode.classList.add('seat-drawn');
      seatNode.querySelector('.student-name').textContent = targetStudent;

      await this.delay(350);
    }

    if (this.isCancelled) return;
    this.finalizeDrawing();
  },

  // --------------------------------------------------------------------------
  // 📦 2. Secret Box Interactive Drawing
  // --------------------------------------------------------------------------
  async runSecretBoxMode() {
    this.displays.playStatus.textContent = '📦 박스를 하나씩 터치하여 숨겨진 자리를 밝히세요!';
    this.buttons.skipDraw.classList.add('hidden'); // No skip needed since it's user clicked

    const activeKeys = Object.keys(this.playGridNodes).filter(key => {
      return AppState.gridLayout[key] !== 'inactive' && AppState.assignment.studentAtSeat[key];
    });

    this.revealedCount = 0;
    this.totalToReveal = activeKeys.length;

    activeKeys.forEach(key => {
      const node = this.playGridNodes[key];
      
      node.addEventListener('click', () => {
        if (node.classList.contains('seat-drawn') || node.classList.contains('box-shaking')) return;

        // Play shake
        node.classList.add('box-shaking');
        SoundSynth.playTick(450, 0.08);

        setTimeout(() => {
          if (this.isCancelled) return;
          node.classList.remove('box-shaking');
          node.classList.remove('seat-box');
          
          // Remove box visual elements
          const sym = node.querySelector('.box-symbol');
          if (sym) sym.remove();

          // Reveal student
          const targetStudent = AppState.assignment.studentAtSeat[key];
          node.classList.add('seat-drawn');
          node.querySelector('.student-name').textContent = targetStudent;
          
          SoundSynth.playReveal();

          // Spark particle on node
          const rect = node.getBoundingClientRect();
          confetti({
            particleCount: 30,
            spread: 50,
            origin: {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight
            }
          });

          this.revealedCount++;
          if (this.revealedCount >= this.totalToReveal) {
            setTimeout(() => {
              this.buttons.skipDraw.classList.remove('hidden');
              this.finalizeDrawing();
            }, 800);
          }
        }, 400);
      });
    });
  },

  // --------------------------------------------------------------------------
  // ⚡ 3. Fast Instant Drawing Animation
  // --------------------------------------------------------------------------
  async runInstantAnimation() {
    this.displays.playStatus.textContent = '⚡ 초고속 매칭 준비 완료!';
    
    // Countdown
    for (let count = 3; count > 0; count--) {
      if (this.isCancelled) return;
      this.displays.playStatus.innerHTML = `⚡ 배치 카운트다운: <strong style="font-size: 2rem; color: var(--color-pink);">${count}</strong>`;
      SoundSynth.playTick(1000, 0.07);
      await this.delay(700);
    }

    if (this.isCancelled) return;
    this.displays.playStatus.textContent = '배치 완료!';
    SoundSynth.playExplosion();

    // Instant fill all
    Object.keys(this.playGridNodes).forEach(key => {
      const node = this.playGridNodes[key];
      const targetStudent = AppState.assignment.studentAtSeat[key];
      if (targetStudent) {
        node.classList.add('seat-drawn');
        node.querySelector('.student-name').textContent = targetStudent;
      }
    });

    await this.delay(600);
    if (this.isCancelled) return;
    this.finalizeDrawing();
  },

  // --------------------------------------------------------------------------
  // 💣 4. Time Bomb Drawing Mode
  // --------------------------------------------------------------------------
  async runBombAnimation() {
    this.displays.playStatus.textContent = '💣 시한폭탄이 폭발하며 당첨자가 결정됩니다!';

    const seatKeys = Object.keys(this.playGridNodes).filter(key => {
      return AppState.gridLayout[key] !== 'inactive' && AppState.assignment.studentAtSeat[key];
    });

    const studentsList = AppState.students;

    for (let i = 0; i < seatKeys.length; i++) {
      if (this.isCancelled) return;

      const key = seatKeys[i];
      const targetStudent = AppState.assignment.studentAtSeat[key];

      if (this.isSkipped) {
        this.playGridNodes[key].classList.add('seat-drawn');
        this.playGridNodes[key].querySelector('.student-name').textContent = targetStudent;
        continue;
      }

      // Highlight target seat
      const seatNode = this.playGridNodes[key];
      seatNode.classList.add('seat-animating');

      // Setup bomb panel overlay
      const r = parseInt(key.split(',')[0]) + 1;
      const c = parseInt(key.split(',')[1]) + 1;
      document.getElementById('bomb-seat-target').textContent = `타겟 자리: [${r}행 ${c}열]`;
      
      const bombNameEl = document.getElementById('bomb-name-display');
      bombNameEl.textContent = '??';
      
      this.overlays.bomb.classList.remove('hidden');

      // Fast ticker interval for random names
      let tickerCount = 0;
      const tickerInterval = setInterval(() => {
        const randName = studentsList[Math.floor(Math.random() * studentsList.length)];
        bombNameEl.textContent = randName;
        tickerCount++;
      }, 60);

      // Bomb ticking delays (starts slow, gets very fast)
      const tickSteps = 8;
      let tickDelay = 220;
      
      for (let step = 0; step < tickSteps; step++) {
        if (this.isCancelled || this.isSkipped) break;
        
        await this.delay(tickDelay);
        SoundSynth.playTick(400 + step * 80, 0.05);
        tickDelay -= 20; // accelerate
      }

      clearInterval(tickerInterval);

      if (this.isCancelled) return;

      // BOOM explosion!
      SoundSynth.playExplosion();
      bombNameEl.textContent = targetStudent;

      // Explode Confetti on target seat
      const rect = seatNode.getBoundingClientRect();
      confetti({
        particleCount: 30,
        spread: 60,
        gravity: 1.1,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight
        }
      });

      // Update node layout
      this.overlays.bomb.classList.add('hidden');
      seatNode.classList.remove('seat-animating');
      seatNode.classList.add('seat-drawn');
      seatNode.querySelector('.student-name').textContent = targetStudent;

      await this.delay(350);
    }

    if (this.isCancelled) return;
    this.finalizeDrawing();
  },

  // --------------------------------------------------------------------------
  // 5. Exports Utilities
  // --------------------------------------------------------------------------
  downloadPNG() {
    const captureArea = document.getElementById('capture-area');
    
    // Add print/capture temporary adjustments (if needed)
    this.buttons.downloadImg.disabled = true;
    this.buttons.downloadImg.textContent = '이미지 제작 중...';

    html2canvas(captureArea, {
      scale: 2, // Retain sharp high DPI image
      useCORS: true,
      backgroundColor: AppState.currentTheme === 'projector' ? '#f8fafc' : '#0a0b10'
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `우리반_자리배치도_${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      this.buttons.downloadImg.disabled = false;
      this.buttons.downloadImg.innerHTML = '<i data-lucide="download"></i> 이미지 저장 (PNG)';
      lucide.createIcons();
    }).catch(err => {
      console.error("html2canvas export error:", err);
      alert("이미지 저장 중 오류가 발생했습니다. 브라우저 보안 설정을 확인하시거나 프린트 인쇄 모드를 사용해 주세요.");
      this.buttons.downloadImg.disabled = false;
      this.buttons.downloadImg.innerHTML = '<i data-lucide="download"></i> 이미지 저장 (PNG)';
      lucide.createIcons();
    });
  }
};

// Start Application on Load
document.addEventListener('DOMContentLoaded', () => {
  UIManager.init();
});
