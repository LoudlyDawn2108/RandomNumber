const form = document.querySelector("#random-form");
const resultNode = document.querySelector("#random-result");
const minInput = document.querySelector("#min-value");
const maxInput = document.querySelector("#max-value");
const shareButton = document.querySelector(".share-button");
const exclusionSummaryNode = document.querySelector("#exclusion-summary");
const exclusionModal = document.querySelector("#exclusion-modal");
const exclusionInput = document.querySelector("#exclusion-input");
const exclusionFeedbackNode = document.querySelector("#exclusion-feedback");
const exclusionSaveButton = document.querySelector("#exclusion-save");
const exclusionCancelButton = document.querySelector("#exclusion-cancel");

const state = {
  min: 1,
  max: 10,
  result: 2,
  exclusions: new Set(),
  isAnimating: false,
};

const integerPattern = /^[+-]?\d+$/;

function syncUi() {
  minInput.value = String(state.min);
  maxInput.value = String(state.max);
  resultNode.textContent = String(state.result);
  renderExclusionSummary();
}

function parseInteger(rawValue) {
  const value = rawValue.trim();

  if (!value || !integerPattern.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readRange() {
  const min = parseInteger(minInput.value);
  const max = parseInteger(maxInput.value);

  if (
    min === null ||
    max === null ||
    min > max ||
    !Number.isSafeInteger(max - min)
  ) {
    return null;
  }

  return { min, max };
}

function restoreLastValidValues() {
  minInput.value = String(state.min);
  maxInput.value = String(state.max);
}

function commitRange(range) {
  state.min = range.min;
  state.max = range.max;
  restoreLastValidValues();
  renderExclusionSummary();
}

function getSortedExclusions() {
  return Array.from(state.exclusions).sort((left, right) => left - right);
}

function serializeExclusions() {
  return getSortedExclusions().join(", ");
}

function getRangeExclusionState(min, max) {
  const active = [];
  const inactive = [];

  for (const value of getSortedExclusions()) {
    if (value >= min && value <= max) {
      active.push(value);
      continue;
    }

    inactive.push(value);
  }

  return { active, inactive };
}

function renderExclusionSummary() {
  exclusionSummaryNode.textContent = "";
  exclusionSummaryNode.classList.remove("is-warning");
}

function setModalFeedback(message, isError = false) {
  exclusionFeedbackNode.textContent = message;
  exclusionFeedbackNode.classList.toggle("is-error", isError);
}

function parseExclusions(rawValue) {
  const tokens = rawValue
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const parsedValues = new Set();
  const invalidTokens = [];

  for (const token of tokens) {
    const value = parseInteger(token);

    if (value === null) {
      invalidTokens.push(token);
      continue;
    }

    parsedValues.add(value);
  }

  return {
    values: parsedValues,
    invalidTokens,
  };
}

function openExclusionModal() {
  exclusionInput.value = serializeExclusions();
  setModalFeedback(
    state.exclusions.size
      ? `${state.exclusions.size} exclusion${state.exclusions.size === 1 ? "" : "s"} currently saved.`
      : "Leave the field blank to clear saved exclusions.",
  );
  exclusionModal.hidden = false;
  exclusionInput.focus();
  exclusionInput.setSelectionRange(
    exclusionInput.value.length,
    exclusionInput.value.length,
  );
}

function closeExclusionModal() {
  exclusionModal.hidden = true;
  setModalFeedback("");
}

function getAllowedCount(min, max) {
  const { active } = getRangeExclusionState(min, max);
  return max - min + 1 - active.length;
}

function chooseAllowedValue(min, max) {
  const { active } = getRangeExclusionState(min, max);
  const allowedCount = max - min + 1 - active.length;
  const targetIndex = Math.floor(Math.random() * allowedCount);
  let candidate = min + targetIndex;

  for (const excludedValue of active) {
    if (excludedValue > candidate) {
      break;
    }

    candidate += 1;
  }

  return candidate <= max ? candidate : state.result;
}

function handleBlur() {
  const range = readRange();

  if (!range) {
    restoreLastValidValues();
    return;
  }

  commitRange(range);
}

function animateRoll(finalValue, duration = 420) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startValue = state.result;
    const distance = Math.abs(finalValue - startValue);
    const direction = finalValue >= startValue ? 1 : -1;
    resultNode.classList.add("is-rolling");

    const tick = () => {
      const elapsed = Math.min(performance.now() - start, duration);
      const progress = duration ? elapsed / duration : 1;

      if (progress >= 1 || !distance) {
        resultNode.textContent = String(finalValue);
        resultNode.classList.remove("is-rolling");
        resolve();
        return;
      }

      const traveled = Math.floor(progress * distance);
      const preview = startValue + direction * traveled;
      resultNode.textContent = String(preview);
      requestAnimationFrame(tick);
    };

    tick();
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.isAnimating) {
    return;
  }

  const range = readRange();

  if (!range) {
    restoreLastValidValues();
    return;
  }

  commitRange(range);

  const allowedCount = getAllowedCount(state.min, state.max);

  if (!allowedCount) {
    renderExclusionSummary();
    return;
  }

  const nextValue = chooseAllowedValue(state.min, state.max);
  state.isAnimating = true;
  await animateRoll(nextValue);
  state.result = nextValue;
  state.isAnimating = false;
}

function handleExclusionSave() {
  const { values, invalidTokens } = parseExclusions(exclusionInput.value);

  if (invalidTokens.length) {
    setModalFeedback(
      `Use whole integers only. Invalid entries: ${invalidTokens.join(", ")}`,
      true,
    );
    return;
  }

  state.exclusions = values;
  renderExclusionSummary();
  closeExclusionModal();
}

function handleModalClick(event) {
  const closeTrigger = event.target.closest('[data-close-modal="true"]');

  if (closeTrigger) {
    closeExclusionModal();
  }
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape" && !exclusionModal.hidden) {
    closeExclusionModal();
  }
}

minInput.addEventListener("blur", handleBlur);
maxInput.addEventListener("blur", handleBlur);
form.addEventListener("submit", handleSubmit);
shareButton.addEventListener("click", openExclusionModal);
exclusionSaveButton.addEventListener("click", handleExclusionSave);
exclusionCancelButton.addEventListener("click", closeExclusionModal);
exclusionModal.addEventListener("click", handleModalClick);
document.addEventListener("keydown", handleDocumentKeydown);

syncUi();
