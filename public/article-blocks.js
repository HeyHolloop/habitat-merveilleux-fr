(function () {
  var PREFIX = "hm";

  function parseSpec(root) {
    var el = root.querySelector("." + PREFIX + "-widget-spec");
    if (!el) return null;
    var raw = el.textContent || "";
    raw = raw.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function collectInputs(form, spec) {
    var inputs = {};
    var fields = spec.fields || spec.questions || [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var name = f.name || f.id;
      if (!name) continue;
      var inp = form.querySelector('[name="' + name + '"]');
      var raw = inp ? inp.value : "";
      if ((f.type || "number") === "number") {
        inputs[name] = num(raw);
      } else {
        inputs[name] = raw;
      }
    }
    return inputs;
  }

  function bindCompute(root, spec) {
    var form = root.querySelector("form");
    var out = root.querySelector("." + PREFIX + "-sim__out, ." + PREFIX + "-quiz__out");
    if (!form || !out || !spec.compute) return;
    var compute;
    try {
      compute = new Function("inputs", spec.compute);
    } catch (e) {
      return;
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var inputs = collectInputs(form, spec);
      try {
        var r = compute(inputs);
        out.hidden = false;
        var prefix = spec.result_label ? spec.result_label + " " : "";
        out.textContent = prefix + String(r);
      } catch (e) {
        out.hidden = false;
        out.textContent = spec.error_text || "Vérifiez les valeurs saisies.";
      }
    });
  }

  function mount(root) {
    var spec = parseSpec(root);
    if (!spec) return;
    bindCompute(root, spec);
  }

  function boot() {
    var nodes = document.querySelectorAll("." + PREFIX + "-sim, ." + PREFIX + "-quiz");
    for (var i = 0; i < nodes.length; i++) {
      mount(nodes[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
