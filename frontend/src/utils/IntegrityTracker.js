/**
 * IntegrityTracker - Comprehensive academic integrity monitoring
 * Tracks: paste events, typing speed, tab/window focus
 *
 * Usage:
 * const tracker = new IntegrityTracker(submissionId, questionId);
 * tracker.startTracking();
 * // ... student works ...
 * const report = tracker.getReport();
 */

export class IntegrityTracker {
  constructor(submissionId, questionId, answerElement) {
    this.submissionId = submissionId;
    this.questionId = questionId;
    this.answerElement = answerElement;

    // Paste tracking
    this.pasteEvents = [];
    this.lastPastedContent = null;

    // Typing tracking
    this.typingStartTime = null;
    this.keyEvents = [];
    this.typingPauses = [];
    this.lastKeyTime = null;
    this.totalTypingTime = 0;
    this.backspaceCount = 0;
    this.totalCharsAdded = 0;

    // Tab/Focus tracking
    this.focusLosses = [];
    this.tabSwitches = [];
    this.isVisible = true;
    this.focusLossStartTime = null;

    // Draft history
    this.draftHistory = [];
    this.lastSavedDraft = null;
    this.lastSaveTime = null;

    // Analysis results
    this.flags = [];
  }

  /**
   * Start tracking all integrity signals
   */
  startTracking() {
    if (!this.answerElement) return;

    // Paste detection
    this.answerElement.addEventListener('paste', (e) => this.handlePaste(e));

    // Typing analysis
    this.answerElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.answerElement.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.answerElement.addEventListener('input', (e) => this.handleInput(e));

    // Tab/window focus tracking
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    window.addEventListener('blur', () => this.handleWindowBlur());
    window.addEventListener('focus', () => this.handleWindowFocus());

    // Auto-save drafts every 30 seconds
    this.draftInterval = setInterval(() => this.saveDraft(), 30000);
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    clearInterval(this.draftInterval);
    // Note: event listeners remain attached (OK for single-use form)
  }

  // ============================================
  // PASTE DETECTION
  // ============================================

  handlePaste(event) {
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    const pasteTime = Date.now();
    const answerBefore = this.answerElement.value;

    // Record paste event
    this.pasteEvents.push({
      timestamp: pasteTime,
      contentLength: pastedText.length,
      preview: pastedText.substring(0, 100),
      answerLengthBefore: answerBefore.length,
      answerLengthAfter: answerBefore.length + pastedText.length,
    });

    this.lastPastedContent = pastedText;

    // Analyze paste behavior
    this.analyzePasteBehavior();
  }

  analyzePasteBehavior() {
    // Flag 1: Instant full answer paste
    if (this.answerElement.value.length > 100 && this.pasteEvents.length === 1) {
      this.addFlag('INSTANT_FULL_PASTE', 'Full answer pasted instantly without typing', 'HIGH');
    }

    // Flag 2: Multiple pastes (copy-paste heavy activity)
    if (this.pasteEvents.length >= 3) {
      this.addFlag('REPEATED_PASTE_ACTIVITY', `${this.pasteEvents.length} paste events detected`, 'MEDIUM');
    }

    // Flag 3: Very large paste (>500 chars at once)
    const lastPaste = this.pasteEvents[this.pasteEvents.length - 1];
    if (lastPaste.contentLength > 500) {
      this.addFlag('LARGE_PASTE_CONTENT', `Large paste detected: ${lastPaste.contentLength} characters`, 'MEDIUM');
    }
  }

  // ============================================
  // TYPING ANALYSIS
  // ============================================

  handleKeyDown(event) {
    if (!this.typingStartTime) {
      this.typingStartTime = Date.now();
    }

    if (event.key === 'Backspace') {
      this.backspaceCount++;
    }

    this.lastKeyTime = Date.now();
  }

  handleKeyUp(event) {
    const now = Date.now();

    // Record keystroke
    if (this.lastKeyTime) {
      const interval = now - this.lastKeyTime;
      this.keyEvents.push({
        timestamp: now,
        interval: interval,
        key: event.key.length === 1 ? 'CHAR' : event.key,
      });
    }

    // Detect pause (>2 seconds without typing)
    if (this.lastKeyTime && now - this.lastKeyTime > 2000) {
      this.typingPauses.push({
        startTime: this.lastKeyTime,
        endTime: now,
        duration: now - this.lastKeyTime,
      });
    }

    this.lastKeyTime = now;
  }

  handleInput(event) {
    const currentLength = this.answerElement.value.length;

    if (this.lastSavedDraft) {
      const lengthDifference = currentLength - this.lastSavedDraft.length;
      if (lengthDifference > 0) {
        this.totalCharsAdded += lengthDifference;
      }
    } else {
      this.totalCharsAdded = currentLength;
    }
  }

  analyzeTypingBehavior() {
    if (!this.typingStartTime) return;

    this.totalTypingTime = Date.now() - this.typingStartTime;
    const answerLength = this.answerElement.value.length;

    // Flag 1: Suspiciously fast typing
    if (answerLength > 200 && this.totalTypingTime < 5000) {
      this.addFlag('SUSPICIOUSLY_FAST', `${answerLength} chars typed in ${(this.totalTypingTime / 1000).toFixed(1)}s`, 'HIGH');
    }

    // Flag 2: No pauses (unusual for longer answers)
    if (answerLength > 150 && this.typingPauses.length === 0) {
      this.addFlag('NO_PAUSES', 'Continuous typing with no pauses for long answer', 'MEDIUM');
    }

    // Flag 3: High backspace ratio (unusual - either copy-paste or very uncertain)
    if (this.keyEvents.length > 0) {
      const backspaceRatio = this.backspaceCount / this.keyEvents.length;
      if (backspaceRatio > 0.3 && answerLength < 50) {
        this.addFlag('HIGH_BACKSPACE_RATIO', 'Excessive corrections/deletions', 'LOW');
      }
    }

    // Flag 4: Very high typing speed (>120 WPM equivalent)
    const estimatedWords = answerLength / 5;
    const minutes = this.totalTypingTime / 60000;
    if (minutes > 0) {
      const wpm = estimatedWords / minutes;
      if (wpm > 120 && answerLength > 200) {
        this.addFlag('VERY_HIGH_TYPING_SPEED', `${wpm.toFixed(0)} WPM - unusually fast`, 'MEDIUM');
      }
    }
  }

  // ============================================
  // TAB/WINDOW FOCUS TRACKING
  // ============================================

  handleVisibilityChange() {
    if (document.hidden) {
      // Tab is now hidden
      this.isVisible = false;
      this.focusLossStartTime = Date.now();
    } else {
      // Tab is now visible
      this.isVisible = true;
      if (this.focusLossStartTime) {
        const duration = Date.now() - this.focusLossStartTime;
        this.focusLosses.push({
          timestamp: this.focusLossStartTime,
          duration: duration,
          type: 'TAB_SWITCH',
        });
        this.focusLossStartTime = null;
      }
    }
  }

  handleWindowBlur() {
    if (!this.isVisible) return; // Already tracking tab switch

    this.isVisible = false;
    this.focusLossStartTime = Date.now();
  }

  handleWindowFocus() {
    if (this.focusLossStartTime) {
      const duration = Date.now() - this.focusLossStartTime;
      this.focusLosses.push({
        timestamp: this.focusLossStartTime,
        duration: duration,
        type: 'WINDOW_BLUR',
      });
      this.focusLossStartTime = null;
    }
    this.isVisible = true;
  }

  analyzeFocusBehavior() {
    // Flag 1: Frequent tab switching
    if (this.focusLosses.length > 5) {
      this.addFlag('FREQUENT_TAB_SWITCHING', `${this.focusLosses.length} tab/window switches detected`, 'MEDIUM');
    }

    // Flag 2: Long absence from question
    const longAbsences = this.focusLosses.filter(fl => fl.duration > 30000); // >30 seconds
    if (longAbsences.length >= 2) {
      this.addFlag('LONG_ABSENCES', `${longAbsences.length} long absences (>30s each)`, 'MEDIUM');
    }

    // Flag 3: Many short switches (pattern of frequent checking external resources)
    const shortSwitches = this.focusLosses.filter(fl => fl.duration < 10000).length;
    if (shortSwitches > 8) {
      this.addFlag('RESOURCE_CHECKING_PATTERN', `${shortSwitches} rapid tab switches detected`, 'MEDIUM');
    }
  }

  // ============================================
  // DRAFT HISTORY
  // ============================================

  saveDraft() {
    const currentAnswer = this.answerElement.value;
    const now = Date.now();

    // Only save if content changed
    if (this.lastSavedDraft === currentAnswer) {
      return;
    }

    this.draftHistory.push({
      timestamp: now,
      content: currentAnswer,
      length: currentAnswer.length,
    });

    this.lastSavedDraft = currentAnswer;
    this.lastSaveTime = now;
  }

  // ============================================
  // FLAG MANAGEMENT
  // ============================================

  addFlag(type, message, severity = 'MEDIUM') {
    this.flags.push({
      type,
      message,
      severity,
      timestamp: Date.now(),
    });
  }

  // ============================================
  // REPORT GENERATION
  // ============================================

  getReport() {
    // Analyze all behaviors
    this.analyzeTypingBehavior();
    this.analyzeFocusBehavior();

    return {
      submissionId: this.submissionId,
      questionId: this.questionId,

      // Paste analysis
      pasteEvents: this.pasteEvents,
      pasteCount: this.pasteEvents.length,

      // Typing analysis
      typingAnalysis: {
        totalTypingTime: this.totalTypingTime,
        totalCharsAdded: this.totalCharsAdded,
        keyEventCount: this.keyEvents.length,
        backspaceCount: this.backspaceCount,
        pauseCount: this.typingPauses.length,
        estimatedWPM: this.estimateWPM(),
      },

      // Focus tracking
      focusLosses: this.focusLosses,
      focusLossCount: this.focusLosses.length,

      // Draft history
      draftCount: this.draftHistory.length,
      draftHistory: this.draftHistory,

      // Flags
      flags: this.flags,
      flagCount: this.flags.length,
      highSeverityFlagCount: this.flags.filter(f => f.severity === 'HIGH').length,

      // Summary
      riskLevel: this.calculateRiskLevel(),
      timestamp: Date.now(),
    };
  }

  estimateWPM() {
    if (this.totalTypingTime === 0) return 0;
    const estimatedWords = this.totalCharsAdded / 5;
    const minutes = this.totalTypingTime / 60000;
    return minutes > 0 ? Math.round(estimatedWords / minutes) : 0;
  }

  calculateRiskLevel() {
    const highSeverityCount = this.flags.filter(f => f.severity === 'HIGH').length;
    const mediumSeverityCount = this.flags.filter(f => f.severity === 'MEDIUM').length;

    const score = highSeverityCount * 30 + mediumSeverityCount * 10;

    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    if (score > 0) return 'LOW';
    return 'CLEAN';
  }

  // ============================================
  // UTILITY
  // ============================================

  clear() {
    this.pasteEvents = [];
    this.keyEvents = [];
    this.typingPauses = [];
    this.focusLosses = [];
    this.draftHistory = [];
    this.flags = [];
    this.typingStartTime = null;
    this.totalTypingTime = 0;
    this.backspaceCount = 0;
    this.totalCharsAdded = 0;
  }

  getFlagsSummary() {
    const summary = {};
    this.flags.forEach(flag => {
      summary[flag.type] = (summary[flag.type] || 0) + 1;
    });
    return summary;
  }

  hasHighRiskFlags() {
    return this.flags.some(f => f.severity === 'HIGH');
  }
}

export default IntegrityTracker;
