/* Sleep Calc — minutes-of-day arithmetic (mod 24 h). Nothing is stored except your preferences. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;
  var KEY = "sleep.v1";
  var DAY = 1440;

  // ---------- pure maths (tested) ----------
  function mod(m) { return ((m % DAY) + DAY) % DAY; }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; }
  function fmt(m, h12) {
    m = mod(Math.round(m));
    var hh = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
    if (!h12) return String(hh).padStart(2, "0") + ":" + mm;
    return (hh % 12 || 12) + ":" + mm + " " + (hh < 12 ? "AM" : "PM");
  }
  // Bedtimes for a wake-up time: wake − n cycles − fall-asleep time.
  function bedtimes(wake, cycles, fall, cyc) { return cycles.map(function (n) { return { n: n, at: mod(wake - n * cyc - fall), sleep: n * cyc }; }); }
  // Wake times for a bedtime: bed + fall-asleep time + n cycles.
  function wakeTimes(bed, cycles, fall, cyc) { return cycles.map(function (n) { return { n: n, at: mod(bed + fall + n * cyc), sleep: n * cyc }; }); }
  function dur(m) { var hh = Math.floor(m / 60), mm = m % 60; return hh + " h" + (mm ? " " + mm + " min" : ""); }

  // ---------- UI ----------
  var st = Object.assign({ mode: "wake", h12: true, time: "07:00", bedTime: "23:00", fall: 15, cyc: 90 }, S3.store(KEY) || {});
  if (["wake", "bed", "now"].indexOf(st.mode) < 0) st.mode = "wake";
  st.h12 = st.h12 !== false;
  if (toMin(st.time) == null) st.time = "07:00";
  if (toMin(st.bedTime) == null) st.bedTime = "23:00";
  st.fall = st.fall >= 0 && st.fall <= 60 ? Math.round(st.fall) : 15;
  st.cyc = st.cyc >= 70 && st.cyc <= 110 ? Math.round(st.cyc) : 90;
  var text = "";
  var LABELS = { 6: "Full night", 5: "Recommended", 4: "Short night", 3: "Bare minimum" };

  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function render() {
    S3.store(KEY, st);
    var n = [6, 5, 4, 3], res = $("#res"), list, ref, h12 = st.h12;
    $("#fallV").textContent = st.fall + " min"; $("#cycV").textContent = st.cyc + " min";
    $("#timeWrap").hidden = st.mode === "now";
    $("#timeLbl").textContent = st.mode === "wake" ? "Wake-up time" : "Bedtime";
    $("#time").value = st.mode === "wake" ? st.time : st.bedTime;
    if (st.mode === "wake") {
      ref = toMin(st.time); list = bedtimes(ref, n, st.fall, st.cyc);
      $("#resTitle").textContent = "To wake up at " + fmt(ref, h12) + ", go to bed at";
    } else {
      ref = st.mode === "now" ? nowMin() : toMin(st.bedTime); list = wakeTimes(ref, n, st.fall, st.cyc);
      $("#resTitle").textContent = st.mode === "now" ? "Going to bed now (" + fmt(ref, h12) + "), wake up at" : "Going to bed at " + fmt(ref, h12) + ", wake up at";
    }
    res.textContent = "";
    list.forEach(function (x) {
      res.appendChild(h("div", { "class": "sc-opt c" + x.n }, [
        h("span", { "class": "sc-tag", text: LABELS[x.n] }),
        h("b", { text: fmt(x.at, h12) }),
        h("span", { "class": "sc-meta", text: x.n + " cycles · " + dur(x.sleep) + " of sleep" }),
        h("span", { "class": "sc-dots", "aria-hidden": "true", text: "●".repeat(x.n) })
      ]));
    });
    $("#resNote").textContent = "Includes " + st.fall + " minutes to fall asleep and " + st.cyc + "-minute cycles. " +
      (st.mode === "wake" ? "Times are counted back from your alarm." : "Set your alarm for one of these.");
    text = $("#resTitle").textContent + ": " + list.map(function (x) { return fmt(x.at, h12) + " (" + x.n + " cycles, " + dur(x.sleep) + ")"; }).join(", ");

    var naps = [[20, "Power nap", "Light sleep only; a quick boost without grogginess"], [30, "Short nap", "Can leave you groggy for a few minutes"],
      [60, "Hour nap", "Reaches deep sleep: helps memory, but expect some grogginess"], [st.cyc, "Full cycle", "One whole cycle, waking in lighter sleep"]];
    var tb = $("#naps"); tb.textContent = ""; var now = nowMin();
    naps.forEach(function (x) {
      tb.appendChild(h("tr", {}, [h("td", {}, [h("b", { text: x[0] + " min" }), h("br"), h("span", { "class": "faint", text: x[1] })]), h("td", { text: x[2] }),
        h("td", { "class": "sc-napat", text: fmt(now + st.fall + x[0], h12) })]));
    });
  }

  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () { $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.v); });
    });
  }
  seg($("#mode"), st.mode, function (v) { st.mode = v; render(); });
  seg($("#clock"), st.h12 ? "12" : "24", function (v) { st.h12 = v === "12"; render(); });
  $("#time").addEventListener("input", function (e) { if (toMin(e.target.value) == null) return; if (st.mode === "wake") st.time = e.target.value; else st.bedTime = e.target.value; render(); });
  $("#fall").value = st.fall; $("#cyc").value = st.cyc;
  $("#fall").addEventListener("input", function (e) { st.fall = +e.target.value; render(); });
  $("#cyc").addEventListener("input", function (e) { st.cyc = +e.target.value; render(); });
  $("#copy").addEventListener("click", function () { S3.copy(text); S3.done(); });
  setInterval(function () { if (document.visibilityState === "visible") render(); }, 30000);
  render();

  window.S3_DEMO = function () { st.time = "06:30"; st.fall = 15; st.cyc = 90; $("#fall").value = 15; $("#cyc").value = 90; $("#mode button[data-v=wake]").click(); };

  window.S3_SELFTEST = function () {
    var b = bedtimes(toMin("07:00"), [6, 5, 4], 15, 90), w = wakeTimes(toMin("23:00"), [6, 5, 4], 15, 90), z = wakeTimes(toMin("00:10"), [5], 0, 90);
    return fmt(b[0].at, false) === "21:45" && fmt(b[1].at, false) === "23:15" && fmt(b[2].at, false) === "00:45" && b[1].sleep === 450 &&
      fmt(w[0].at, false) === "08:15" && fmt(w[1].at, false) === "06:45" && fmt(w[2].at, false) === "05:15" && fmt(z[0].at, false) === "07:40" &&
      fmt(1305, true) === "9:45 PM" && fmt(45, true) === "12:45 AM" && fmt(720, true) === "12:00 PM" && fmt(-30, false) === "23:30" &&
      dur(450) === "7 h 30 min" && dur(540) === "9 h" && toMin("24:00") === null;
  };
})();
