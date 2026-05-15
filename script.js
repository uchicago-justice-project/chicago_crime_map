const width = document.getElementById("vis").clientWidth;
const height = window.innerHeight;

const svgRT = d3.select("#vis-rt")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .classed("responsive-svg", true);

const svg = d3.select("#vis")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .classed("responsive-svg", true);

const projection = d3.geoMercator();
const path = d3.geoPath().projection(projection);
const tooltip = d3.select("#tooltip");
let colorScale;

Promise.all([
  d3.json("beats_with_stats_v2.geojson"),
  d3.csv("monthly_response_time.csv")
]).then(([data, tsData]) => {
  projection.fitSize([width, height], data);
  drawTimeSeries(tsData);

  window.addEventListener("resize", () => {
    const newWidth = document.getElementById("vis").clientWidth;
    const newHeight = window.innerHeight;
    projection.fitSize([newWidth, newHeight], data);
    svgRT.selectAll("path").attr("d", path);
    svg.selectAll("path").attr("d", path);
  });

  // --- Response Time Map ---

  const colorScaleRT = d3.scaleDiverging()
    .domain([-10, 0, 10])
    .interpolator(t => d3.interpolateRdBu(1 - t));

  const legendRTSvg = d3.select("#legend-rt-scale");
  const defsRT = legendRTSvg.append("defs");
  const legendRTGradient = defsRT.append("linearGradient")
    .attr("id", "legend-rt-gradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");
  legendRTGradient.selectAll("stop")
    .data([
      { offset: "0%", color: colorScaleRT(-10) },
      { offset: "50%", color: colorScaleRT(0) },
      { offset: "100%", color: colorScaleRT(10) }
    ])
    .enter().append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);
  legendRTSvg.append("rect")
    .attr("width", 20)
    .attr("height", 200)
    .style("fill", "url(#legend-rt-gradient)");

  svgRT.selectAll("path")
    .data(data.features)
    .enter().append("path")
    .attr("class", "rt-beat")
    .attr("d", path)
    .attr("fill", d => colorScaleRT(d.properties.diff_u))
    .attr("stroke", d => d.properties.shotspotter === 1 ? "#000" : "#555")
    .attr("stroke-width", d => d.properties.shotspotter === 1 ? 1.5 : 0.5)
    .attr("opacity", 1)
    .on("mouseover", function(event, d) {
      const p = d.properties;
      const sign = p.diff_u > 0 ? "+" : "";
      tooltip
        .style("display", "block")
        .html(`
          <strong>Beat:</strong> ${p.beat_num}<br/>
          <strong>Avg Response Time Before:</strong> ${p.p0_u.toFixed(1)} min<br/>
          <strong>Avg Response Time After:</strong> ${p.p1_u.toFixed(1)} min<br/>
          <strong>Change:</strong> ${sign}${p.diff_u.toFixed(1)} min<br/>
          <strong>Had ShotSpotter:</strong> ${p.shotspotter === 1 ? "Yes" : "No"}
        `);
      d3.select(this).raise().attr("stroke-width", 2.5);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(event, d) {
      tooltip.style("display", "none");
      d3.select(this).attr("stroke-width", d.properties.shotspotter === 1 ? 1.5 : 0.5);
    });

  const scrollerRT = scrollama();
  scrollerRT
    .setup({ step: ".step-rt", offset: 0.5 })
    .onStepEnter(response => {
      updateResponseTimeMap(response.index);
    });

  // --- Crime Map ---

  colorScale = d3.scaleDiverging()
    .domain([-0.6, 0, 0.6])
    .interpolator(t => d3.interpolateRdBu(1 - t));

  const legendSvg = d3.select("#legend-scale");
  const defs = legendSvg.append("defs");
  const legendGradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%");
  legendGradient.selectAll("stop")
    .data([
      { offset: "0%", color: colorScale(-0.6) },
      { offset: "50%", color: colorScale(0) },
      { offset: "100%", color: colorScale(0.6) }
    ])
    .enter().append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);
  legendSvg.append("rect")
    .attr("width", 20)
    .attr("height", 200)
    .style("fill", "url(#legend-gradient)");

  d3.selectAll("#filter-controls button").on("click", function() {
    const filter = this.dataset.filter;
    d3.selectAll("#filter-controls button").classed("active", false);
    d3.select(this).classed("active", true);
    svg.selectAll(".choropleth")
      .transition().duration(400)
      .attr("opacity", d => {
        if (filter === "all") return 1;
        if (filter === "peacekeepers") return d.properties.peacekeeper === 1 ? 1 : 0.2;
        if (filter === "hotspot") return d.properties.hotspot === 1 ? 1 : 0.2;
        if (filter === "shotspotter") return d.properties.shotspotter === 1 ? 1 : 0.2;
      });
  });

  svg.selectAll("path")
    .data(data.features)
    .enter().append("path")
    .attr("class", "choropleth")
    .attr("d", path)
    .attr("fill", d => colorScale(d.properties.VIOLENT_CRIMES_PCT_DIFF))
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr("opacity", 1)
    .on("mouseover", function(event, d) {
      tooltip
        .style("display", "block")
        .html(`
          <strong>Beat Num:</strong> ${d.properties.beat_num}<br/>
          <strong>Violent Crimes Jan-Sept 2024:</strong> ${d.properties.VIOLENT_CRIMES_YTD_2024}<br/>
          <strong>Violent Crimes Jan-Sept 2025:</strong> ${d.properties.VIOLENT_CRIMES_YTD_2025}<br/>
          <strong>Change in Violent Crime:</strong> ${Math.round(d.properties.VIOLENT_CRIMES_PCT_DIFF * 10000) / 100}%<br/>
          <strong>Former Shotspotter:</strong> ${d.properties.shotspotter === 1 ? "Yes" : "No"}<br/>
          <strong>Hotspot:</strong> ${d.properties.hotspot === 1 ? "Yes" : "No"}<br/>
          <strong>Peacekeeper:</strong> ${d.properties.peacekeeper === 1 ? "Yes" : "No"}
        `);
      d3.select(this).raise().attr("stroke-width", 2);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
      d3.select(this).attr("stroke-width", 0.5);
    });

  const scroller = scrollama();
  scroller
    .setup({ step: ".step", offset: 0.5 })
    .onStepEnter(response => {
      updateMap(response.index, data.features);
    });
});

function drawTimeSeries(tsData) {
  const container = document.getElementById("timeseries-chart");
  const totalWidth = container.clientWidth;
  const margin = { top: 30, right: 30, bottom: 60, left: 70 };
  const chartWidth = totalWidth - margin.left - margin.right;
  const chartHeight = 300 - margin.top - margin.bottom;

  const parseDate = d3.timeParse("%Y-%m-%d");
  tsData.forEach(d => {
    d.date = parseDate(d.period_start);
    d.value = +d.treated_minus_control_diff;
  });

  const chartSvg = d3.select("#timeseries-chart")
    .append("svg")
    .attr("width", totalWidth)
    .attr("height", chartHeight + margin.top + margin.bottom);

  const g = chartSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Extend x domain slightly for breathing room
  const dates = tsData.map(d => d.date);
  const xPad = 15 * 24 * 60 * 60 * 1000; // 15 days in ms
  const xScale = d3.scaleTime()
    .domain([new Date(d3.min(dates) - xPad), new Date(d3.max(dates) + xPad)])
    .range([0, chartWidth]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(tsData, d => d.value).map((v, i) => i === 0 ? v - 0.4 : v + 0.4))
    .nice()
    .range([chartHeight, 0]);

  // Zero baseline
  g.append("line")
    .attr("x1", 0).attr("x2", chartWidth)
    .attr("y1", yScale(0)).attr("y2", yScale(0))
    .attr("stroke", "#bbb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,3");

  g.append("text")
    .attr("x", chartWidth + 4)
    .attr("y", yScale(0) + 4)
    .attr("font-size", "10px")
    .attr("fill", "#999")
    .text("baseline");

  // ShotSpotter shutdown line (between period 5 and 6: Sep 22 2024)
  const shutdownDate = new Date("2024-08-22");
  g.append("line")
    .attr("x1", xScale(shutdownDate)).attr("x2", xScale(shutdownDate))
    .attr("y1", 0).attr("y2", chartHeight)
    .attr("stroke", "#444")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6,4");

  g.append("text")
    .attr("x", xScale(shutdownDate) + 6)
    .attr("y", 14)
    .attr("font-size", "11px")
    .attr("fill", "#444")
    .attr("font-style", "italic")
    .text("ShotSpotter shutdown");

  // Line
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(tsData)
    .attr("fill", "none")
    .attr("stroke", "#2166ac")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  // Dots
  g.selectAll("circle")
    .data(tsData)
    .enter().append("circle")
    .attr("cx", d => xScale(d.date))
    .attr("cy", d => yScale(d.value))
    .attr("r", 5)
    .attr("fill", "#2166ac")
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      const fmt = d3.timeFormat("%b %Y");
      const sign = d.value > 0 ? "+" : "";
      tooltip
        .style("display", "block")
        .html(`
          <strong>${fmt(d.date)}</strong><br/>
          ShotSpotter vs. control: <strong>${sign}${d.value.toFixed(2)} min</strong>
        `);
      d3.select(this).attr("r", 7);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
      d3.select(this).attr("r", 5);
    });

  // X axis
  const xAxis = g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale)
      .tickValues(tsData.map(d => d.date))
      .tickFormat(d => d3.timeFormat("%b '%y")(d3.timeMonth.offset(d, 1))));

  xAxis.selectAll("text")
    .attr("transform", "rotate(-35)")
    .attr("text-anchor", "end")
    .attr("dx", "-0.4em")
    .attr("dy", "0.6em")
    .attr("font-size", "11px");

  // Y axis
  g.append("g")
    .call(d3.axisLeft(yScale)
      .tickFormat(d => `${d > 0 ? "+" : ""}${d.toFixed(1)} min`)
      .ticks(6));

  // Y axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 14)
    .attr("x", -chartHeight / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#444")
    .text("Minutes vs. baseline (Sep '24)");
}

function updateResponseTimeMap(step) {
  if (step === 0) {
    d3.select("#legend-rt").transition().duration(300).style("opacity", 0);
  }
  if (step === 1) {
    d3.select("#legend-rt").transition().duration(300).style("opacity", 1);
    d3.select("#legend").transition().duration(300).style("opacity", 0);
    svgRT.selectAll(".rt-beat")
      .transition().duration(300)
      .attr("opacity", 1);
  }
  if (step === 2) {
    d3.select("#legend-rt").transition().duration(300).style("opacity", 1);
    d3.select("#legend").transition().duration(300).style("opacity", 0);
    svgRT.selectAll(".rt-beat")
      .transition().duration(300)
      .attr("opacity", d => d.properties.shotspotter === 1 ? 1 : 0.2);
  }
  if (step === 3) {
    d3.select("#legend-rt").transition().duration(300).style("opacity", 0);
  }
}

function updateMap(step, features) {
  d3.select("#legend-rt").transition().duration(300).style("opacity", 0);

  if (step === 1) {
    svg.selectAll(".choropleth")
      .transition().duration(300)
      .attr("opacity", 1);
  }
  if (step === 2) {
    svg.selectAll(".choropleth")
      .transition().duration(300)
      .attr("opacity", d => d.properties.shotspotter === 1 ? 1 : 0.2);
  }
  if (step === 3) {
    svg.selectAll(".choropleth")
      .transition().duration(300)
      .attr("opacity", d => d.properties.hotspot === 1 ? 1 : 0.2);
  }
  if (step === 4) {
    svg.selectAll(".choropleth")
      .transition().duration(300)
      .attr("opacity", d => d.properties.peacekeeper === 1 ? 1 : 0.2);
  }
  if (step === 5 || step === 6) {
    svg.selectAll(".choropleth")
      .transition().duration(300)
      .attr("opacity", 1);
    d3.select("#filter-controls").style("display", "flex");
  } else {
    d3.select("#filter-controls").style("display", "none");
  }

  if (step === 0) {
    d3.select("#legend").transition().duration(300).style("opacity", 0);
  } else {
    d3.select("#legend").transition().duration(300).style("opacity", 1);
  }
}
