(() => {
  const exprEl = document.getElementById("expr");
  const previewEl = document.getElementById("preview");
  const keysEl = document.querySelector(".keys");
  const historyListEl = document.getElementById("history-list");
  const historyEmptyEl = document.getElementById("history-empty");
  const clearHistoryBtn = document.getElementById("clear-history");

  const OPS = ["+", "−", "×", "÷"];
  const isOp = (c) => OPS.includes(c);
  const isDigit = (c) => c !== undefined && c >= "0" && c <= "9";

  let expr = "";
  let note = "";            // shows the previous calculation after "="
  let error = "";
  let justEvaluated = false;

  // ---------- History (saved in this browser) ----------
  const HISTORY_KEY = "oyao-calculator-history";
  const MAX_HISTORY = 12;

  function loadHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (!Array.isArray(data)) return [];
      return data
        .filter((x) => x && typeof x.expr === "string" && typeof x.result === "string")
        .slice(0, MAX_HISTORY);
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* storage not available, history just won't persist */
    }
  }

  let history = loadHistory();

  function renderHistory() {
    historyListEl.replaceChildren();
    historyEmptyEl.hidden = history.length > 0;
    clearHistoryBtn.hidden = history.length === 0;

    history.forEach((item, index) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hist-item";
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", `Use result ${item.result}`);

      const e = document.createElement("span");
      e.className = "hist-expr";
      e.textContent = item.expr;

      const r = document.createElement("span");
      r.className = "hist-result";
      r.textContent = "= " + item.result;

      btn.append(e, r);
      li.appendChild(btn);
      historyListEl.appendChild(li);
    });
  }

  function recall(index) {
    const item = history[index];
    if (!item) return;
    error = "";
    expr = item.result.includes("e") ? "" : item.result;
    note = item.expr + " =";
    justEvaluated = true;
    render();
  }

  // ---------- Safe evaluator (no eval) ----------
  function evaluate(src) {
    let s = src;
    while (s && isOp(s[s.length - 1])) s = s.slice(0, -1);
    if (!s) return null;

    let i = 0;
    const peek = () => s[i];

    function parseExpr() {
      let v = parseTerm();
      while (peek() === "+" || peek() === "−") {
        const op = s[i++];
        const r = parseTerm();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }

    function parseTerm() {
      let v = parseFactor();
      while (peek() === "×" || peek() === "÷") {
        const op = s[i++];
        const r = parseFactor();
        if (op === "÷" && r === 0) throw new Error("Can't divide by zero");
        v = op === "×" ? v * r : v / r;
      }
      return v;
    }

    function parseFactor() {
      if (peek() === "−") { i++; return -parseFactor(); }
      const start = i;
      while (isDigit(peek()) || peek() === ".") i++;
      if (start === i) throw new Error("Invalid input");
      let v = parseFloat(s.slice(start, i));
      if (Number.isNaN(v)) throw new Error("Invalid input");
      while (peek() === "%") { i++; v /= 100; }
      return v;
    }

    const result = parseExpr();
    if (i !== s.length) throw new Error("Invalid input");
    return result;
  }

  function format(n) {
    if (!Number.isFinite(n)) throw new Error("Invalid result");
    return String(parseFloat(n.toPrecision(12))).replace("-", "−");
  }

  function lastNumber() {
    return expr.split(/[+−×÷]/).pop();
  }

  function startFresh() {
    if (justEvaluated) {
      expr = "";
      note = "";
      justEvaluated = false;
    }
  }

  function continueFromResult() {
    if (justEvaluated) {
      note = "";
      justEvaluated = false;
    }
  }

  function press(action, value) {
    if (error) { error = ""; expr = ""; note = ""; justEvaluated = false; }

    switch (action) {
      case "digit": {
        startFresh();
        if (expr.slice(-1) === "%") return;
        if (lastNumber() === "0") expr = expr.slice(0, -1);
        expr += value;
        break;
      }
      case "dot": {
        startFresh();
        if (expr.slice(-1) === "%") return;
        const seg = lastNumber();
        if (seg.includes(".")) return;
        expr += seg === "" ? "0." : ".";
        break;
      }
      case "op": {
        continueFromResult();
        if (expr === "") {
          if (value === "−") expr = "−";
          return render();
        }
        if (expr === "−") return;
        if (isOp(expr.slice(-1))) expr = expr.slice(0, -1);
        expr += value;
        break;
      }
      case "percent": {
        continueFromResult();
        const last = expr.slice(-1);
        if (isDigit(last) || last === "%") expr += "%";
        break;
      }
      case "delete": {
        continueFromResult();
        expr = expr.slice(0, -1);
        break;
      }
      case "clear": {
        expr = "";
        note = "";
        justEvaluated = false;
        break;
      }
      case "equals": {
        if (!expr) return;
        try {
          const result = evaluate(expr);
          if (result === null) return;
          const text = format(result);
          note = expr + " =";

          if (!justEvaluated || history[0]?.expr !== expr) {
            history.unshift({ expr, result: text });
            history = history.slice(0, MAX_HISTORY);
            saveHistory();
            renderHistory();
          }

          expr = text.includes("e") ? "" : text;
          justEvaluated = true;
        } catch (e) {
          error = e.message;
          expr = "";
        }
        break;
      }
    }
    render();
  }

  function render() {
    const shown = error ? "Error" : expr || "0";
    exprEl.textContent = shown;
    exprEl.className = "main" + (shown.length > 16 ? " sm" : shown.length > 10 ? " md" : "");

    if (error) {
      previewEl.textContent = error;
    } else if (justEvaluated) {
      previewEl.textContent = note;
    } else if (/[+−×÷%]/.test(expr.slice(1))) {
      try {
        const r = evaluate(expr);
        previewEl.textContent = r === null ? "" : "= " + format(r);
      } catch {
        previewEl.textContent = "";
      }
    } else {
      previewEl.textContent = "";
    }
  }

  keysEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) press(btn.dataset.action, btn.dataset.value);
  });

  historyListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button.hist-item");
    if (btn) recall(Number(btn.dataset.index));
  });

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Let Enter/Space work normally on the history and Clear buttons
    if (e.target.closest && e.target.closest(".history") && (e.key === "Enter" || e.key === " ")) return;
    const k = e.key;

    if (isDigit(k) && k.length === 1) press("digit", k);
    else if (k === "." || k === ",") press("dot");
    else if (k === "+") press("op", "+");
    else if (k === "-") press("op", "−");
    else if (k === "*" || k === "x" || k === "X") press("op", "×");
    else if (k === "/") press("op", "÷");
    else if (k === "%") press("percent");
    else if (k === "Enter" || k === "=") press("equals");
    else if (k === "Backspace") press("delete");
    else if (k === "Escape") press("clear");
    else return;

    e.preventDefault();
  });

  renderHistory();
  render();
})();