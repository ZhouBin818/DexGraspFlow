document.addEventListener('DOMContentLoaded', () => {
  // 1. Copy BibTeX button
  window.copyBibTeX = function() {
    const bibtexEl = document.getElementById('bibtex-code');
    if (!bibtexEl) return;
    const text = bibtexEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.copy-button');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      }
    });
  };

  // 2. DexGraspFlow 3D Interactive Grasp Visualizer Logic
  const modelBase = (window.DEXGRASPFLOW_MODEL_BASE || "./static/assets").replace(/\/$/, "");
  function modelURL(path) {
    return `${modelBase}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  document.querySelectorAll('model-viewer[data-model-path]').forEach((viewer) => {
    const status = document.createElement('p');
    status.className = 'model-load-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading 3D model…';
    viewer.parentElement.insertAdjacentElement('afterend', status);
    viewer.addEventListener('load', () => { status.textContent = ''; });
    viewer.addEventListener('error', () => {
      status.textContent = 'Model could not load. Please try another sample or reload the page.';
    });
    new MutationObserver(() => { status.textContent = 'Loading 3D model…'; })
      .observe(viewer, { attributes: true, attributeFilter: ['src'] });
    viewer.src = modelURL(viewer.dataset.modelPath);
  });
  function resolveModelPath(mode, hand, obj, gid) {
    const numGid = Math.min(Math.max(parseInt(gid, 10) || 0, 0), 9);
    return modelURL(`${mode}/${hand}/${obj}/${numGid}.glb`);
  }

  // --- Unconditioned Grasp Synthesis ---
  const uncondViewers = [
    document.getElementById("uncond-viewer1"),
    document.getElementById("uncond-viewer2"),
    document.getElementById("uncond-viewer3")
  ];
  const uncondObject = document.getElementById("uncond-object");
  const uncondSlider = document.getElementById("uncond-id");
  const uncondLabel = document.getElementById("uncond-id-label");

  function updateUncond() {
    if (!uncondObject || !uncondSlider || !uncondLabel) return;
    const obj = uncondObject.value;
    const gid = uncondSlider.value;
    uncondLabel.textContent = gid;

    const hands = ['Barrett', 'Allegro', 'Shadowhand'];
    hands.forEach((hand, idx) => {
      if (uncondViewers[idx]) {
        uncondViewers[idx].src = resolveModelPath('uncond', hand, obj, gid);
      }
    });
  }

  if (uncondObject && uncondSlider) {
    uncondObject.addEventListener("change", updateUncond);
    uncondSlider.addEventListener("input", updateUncond);
  }

  // --- Conditioned Grasp Synthesis (Plan B: Decoupled Direction + Candidate Sample) ---
  const condViewers = [
    document.getElementById("cond-viewer1"),
    document.getElementById("cond-viewer2"),
    document.getElementById("cond-viewer3")
  ];
  const condObject = document.getElementById("cond-object");
  const condSampleSlider = document.getElementById("cond-sample-id");
  const condSampleLabel = document.getElementById("cond-sample-label");
  const dirPills = document.querySelectorAll(".dir-pill");

  let currentCondDir = "front";
  let currentCondSample = 0;
  let condPoeMetadata = null;
  const poeBadges = [
    document.getElementById("cond-poe-badge-1"),
    document.getElementById("cond-poe-badge-2"),
    document.getElementById("cond-poe-badge-3")
  ];

  fetch("./static/assets/cond/poe_metadata.json?v=20261016-refined")
    .then((res) => res.json())
    .then((data) => {
      condPoeMetadata = data;
      updateCondPoe();
    })
    .catch((err) => console.log("POE metadata loading deferred", err));

  function updateCondPoe() {
    if (!condPoeMetadata || !condObject) return;
    const obj = condObject.value;
    const hands = ['Barrett', 'Allegro', 'Shadowhand'];
    hands.forEach((hand, idx) => {
      const badge = poeBadges[idx];
      if (badge) {
        const val = condPoeMetadata[hand]?.[obj]?.[currentCondDir]?.[currentCondSample];
        if (val !== undefined) {
          badge.textContent = `POE: ${val.toFixed(1)}°`;
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      }
    });
  }

  function resolveCondModelPath(hand, obj, dir, sample) {
    const replacement = window.DEXGRASPFLOW_CONDITIONED_REPLACEMENTS?.[hand]?.[obj]?.[dir]?.[sample];
    return modelURL(replacement || `cond/${hand}/${obj}/${dir}_${sample}.glb`);
  }

  function updateCondViewers() {
    if (!condObject) return;
    const obj = condObject.value;
    const hands = ['Barrett', 'Allegro', 'Shadowhand'];
    hands.forEach((hand, idx) => {
      if (condViewers[idx]) {
        condViewers[idx].src = resolveCondModelPath(hand, obj, currentCondDir, currentCondSample);
      }
    });
  }

  function updateCond() {
    // 1. 更新方向按钮高亮
    dirPills.forEach((pill) => {
      if (pill.getAttribute("data-dir") === currentCondDir) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    // 2. 更新候选样本标签（与上方 Grasp ID 保持一致）
    if (condSampleLabel) {
      condSampleLabel.textContent = `${currentCondSample}`;
    }

    // 3. 更新 3D 模型与 POE 徽章
    updateCondViewers();
    updateCondPoe();
  }

  // 点击方向按钮：只切换方向，保持当前样本
  dirPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const selectedDir = pill.getAttribute("data-dir");
      if (selectedDir && selectedDir !== currentCondDir) {
        currentCondDir = selectedDir;
        updateCond();
      }
    });
  });

  // 拖动样本滑块：只切换样本，保持当前方向
  if (condSampleSlider) {
    condSampleSlider.addEventListener("input", () => {
      currentCondSample = parseInt(condSampleSlider.value, 10) || 0;
      updateCond();
    });
  }

  // 切换物体：保持当前选中的方向与样本
  if (condObject) {
    condObject.addEventListener("change", () => {
      updateCondViewers();
      updateCondPoe();
    });
  }

  // --- Block 3: Zero-Shot Topology Generalization (Finger-Removal Hands) ---
  const zeroViewerAllegro = document.getElementById("zero-viewer-allegro");
  const zeroViewerShadow = document.getElementById("zero-viewer-shadow");
  const zeroObject = document.getElementById("zero-object");
  const zeroSlider = document.getElementById("zero-sample-id");
  const zeroLabel = document.getElementById("zero-sample-label");

  const allegroPills = document.querySelectorAll(".allegro-pill");
  const shadowPills = document.querySelectorAll(".shadow-pill");

  let currentAllegroVariant = "allegro_wo_f3";
  let currentShadowVariant = "shadowhand_wo_ff";
  let currentZeroSample = 0;

  function resolveZeroModelPath(variant, obj, sample) {
    const s = Math.min(Math.max(parseInt(sample, 10) || 0, 0), 9);
    return modelURL(`zero_shot/${variant}/${obj}/${s}.glb`);
  }

  function updateZeroViewers() {
    if (!zeroObject) return;
    const obj = zeroObject.value;

    if (zeroViewerAllegro) {
      zeroViewerAllegro.src = resolveZeroModelPath(currentAllegroVariant, obj, currentZeroSample);
    }
    if (zeroViewerShadow) {
      zeroViewerShadow.src = resolveZeroModelPath(currentShadowVariant, obj, currentZeroSample);
    }
    if (zeroLabel) {
      zeroLabel.textContent = `${currentZeroSample}`;
    }
  }

  // Allegro variant selector pills
  allegroPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const v = pill.getAttribute("data-variant");
      if (v && v !== currentAllegroVariant) {
        currentAllegroVariant = v;
        allegroPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        updateZeroViewers();
      }
    });
  });

  // ShadowHand variant selector pills
  shadowPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const v = pill.getAttribute("data-variant");
      if (v && v !== currentShadowVariant) {
        currentShadowVariant = v;
        shadowPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        updateZeroViewers();
      }
    });
  });

  // Object selector change
  if (zeroObject) {
    zeroObject.addEventListener("change", updateZeroViewers);
  }


  // Grasp sample slider input
  if (zeroSlider) {
    zeroSlider.addEventListener("input", () => {
      currentZeroSample = parseInt(zeroSlider.value, 10) || 0;
      updateZeroViewers();
    });
  }
});
