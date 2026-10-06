import { Controller } from "@hotwired/stimulus";
import * as d3 from "d3";

// Connects to data-controller="category-trend"
//
// One small line chart of monthly spending for a category. The flat hairline
// is the category's monthly average, the shaded band the selected Reports
// period. Hover (or focus and use the arrow keys) to read a month's value.
export default class extends Controller {
  static targets = ["chart"];
  static values = {
    points: { type: Array, default: [] },
    average: { type: Number, default: 0 },
    averageLabel: String,
    selected: { type: Array, default: [] },
    name: String,
  };

  #resizeObserver = null;
  #tooltip = null;
  #index = null;
  #x = null;
  #y = null;
  #svg = null;

  connect() {
    this.#draw();
    this.#resizeObserver = new ResizeObserver(() => this.#draw());
    this.#resizeObserver.observe(this.chartTarget);
    this.element.addEventListener("keydown", this.#onKeydown);
    this.element.addEventListener("focus", this.#onFocus);
    this.element.addEventListener("blur", this.#clear);
  }

  disconnect() {
    this.#resizeObserver?.disconnect();
    this.element.removeEventListener("keydown", this.#onKeydown);
    this.element.removeEventListener("focus", this.#onFocus);
    this.element.removeEventListener("blur", this.#clear);
    this.#tooltip?.remove();
  }

  #draw() {
    const width = this.chartTarget.clientWidth;
    const height = this.chartTarget.clientHeight;
    const points = this.pointsValue;
    if (!width || !height || points.length < 2) return;

    d3.select(this.chartTarget).selectAll("*").remove();
    const pad = 4;
    const max = d3.max(points, (p) => p.value) || 1;
    this.#x = d3
      .scaleLinear()
      .domain([0, points.length - 1])
      .range([pad, width - pad]);
    this.#y = d3
      .scaleLinear()
      .domain([0, max])
      .range([height - pad, pad]);

    const svg = d3
      .select(this.chartTarget)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "block overflow-visible");
    this.#svg = svg;

    const [first, last] = this.selectedValue;
    if (
      first !== null &&
      first !== undefined &&
      last !== null &&
      last !== undefined
    ) {
      const step = (width - 2 * pad) / (points.length - 1);
      svg
        .append("rect")
        .attr("x", this.#x(first) - step / 2)
        .attr("y", 0)
        .attr("width", Math.max(step, this.#x(last) - this.#x(first) + step))
        .attr("height", height)
        .attr("fill", "var(--color-surface-inset)");
    }

    svg
      .append("line")
      .attr("x1", pad)
      .attr("x2", width - pad)
      .attr("y1", this.#y(0))
      .attr("y2", this.#y(0))
      .attr("class", "text-subdued")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.4);

    svg
      .append("line")
      .attr("x1", pad)
      .attr("x2", width - pad)
      .attr("y1", this.#y(this.averageValue))
      .attr("y2", this.#y(this.averageValue))
      .attr("class", "text-secondary")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.6);

    svg
      .append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "var(--color-info)")
      .attr("stroke-width", 2)
      .attr("stroke-linejoin", "round")
      .attr(
        "d",
        d3
          .line()
          .x((_, i) => this.#x(i))
          .y((p) => this.#y(p.value)),
      );

    this.crosshair = svg
      .append("line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("class", "text-secondary")
      .attr("stroke", "currentColor")
      .attr("opacity", 0);
    this.dot = svg
      .append("circle")
      .attr("r", 4)
      .attr("fill", "var(--color-info)")
      .attr("stroke", "var(--color-container)")
      .attr("stroke-width", 2)
      .attr("opacity", 0);

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [mx] = d3.pointer(event);
        this.#show(Math.round(this.#x.invert(mx)), event);
      })
      .on("pointerleave", this.#clear);
  }

  // Keyboard focus reads out the latest month, as hover reads the pointed one.
  #onFocus = () => {
    this.#show(this.pointsValue.length - 1);
  };

  #onKeydown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation(); // keep the Reports period hotkeys from firing
    const last = this.pointsValue.length - 1;
    const current = this.#index ?? last;
    this.#show(
      Math.min(
        last,
        Math.max(0, current + (event.key === "ArrowRight" ? 1 : -1)),
      ),
    );
  };

  #show(index, event = null) {
    const points = this.pointsValue;
    const i = Math.min(points.length - 1, Math.max(0, index));
    this.#index = i;
    const p = points[i];
    const cx = this.#x(i);
    this.crosshair?.attr("x1", cx).attr("x2", cx).attr("opacity", 0.5);
    this.dot?.attr("cx", cx).attr("cy", this.#y(p.value)).attr("opacity", 1);

    if (!this.#tooltip) {
      this.#tooltip = document.createElement("div");
      this.#tooltip.className =
        "fixed z-50 pointer-events-none bg-container text-primary shadow-border-xs rounded-lg px-3 py-2 text-xs";
      this.#tooltip.setAttribute("role", "tooltip");
      document.body.appendChild(this.#tooltip);
    }
    this.#tooltip.replaceChildren();
    const value = document.createElement("div");
    value.className = "font-medium text-sm";
    value.textContent = p.display;
    const label = document.createElement("div");
    label.className = "text-secondary";
    label.textContent = `${this.nameValue} · ${p.label}`;
    const avg = document.createElement("div");
    avg.className = "text-secondary";
    avg.textContent = this.averageLabelValue;
    this.#tooltip.append(value, label, avg);
    this.#tooltip.hidden = false;

    const box = this.chartTarget.getBoundingClientRect();
    const x = event?.clientX ?? box.left + cx;
    const y = event?.clientY ?? box.top;
    this.#tooltip.style.left = `${Math.min(x + 12, window.innerWidth - this.#tooltip.offsetWidth - 8)}px`;
    this.#tooltip.style.top = `${Math.max(8, y - this.#tooltip.offsetHeight - 12)}px`;
  }

  #clear = () => {
    this.#index = null;
    this.crosshair?.attr("opacity", 0);
    this.dot?.attr("opacity", 0);
    if (this.#tooltip) this.#tooltip.hidden = true;
  };
}
