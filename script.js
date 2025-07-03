const width = document.getElementById("vis").clientWidth;
const height = window.innerHeight;
let colorScale;


// Create SVG
const svg = d3.select("#vis").append("svg")
  .attr("width", width)
  .attr("height", height);

// Define projection and path
const projection = d3.geoMercator()
  .scale(1)
  .translate([0, 0]);

const path = d3.geoPath().projection(projection);

// Load GeoJSON
d3.json("beats_with_stats.geojson").then(data => {
  // Compute bounds and adjust projection
  const bounds = path.bounds(data);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const scale = 0.95 / Math.max(dx / width, dy / height);
  const translate = [
    (width - scale * (bounds[1][0] + bounds[0][0])) / 2,
    (height - scale * (bounds[1][1] + bounds[0][1])) / 2
  ];
  projection.scale(scale).translate(translate);

  // Draw polygons
const values = data.features.map(d => d.properties.VIOLENT_CRIMES_PCT_DIFF);

colorScale = d3.scaleDiverging()
  .domain([1, 0, -1])
  .interpolator(d3.interpolateRdBu);

svg.selectAll("path")
  .data(data.features)
  .enter().append("path")
  .attr("d", path)
  .attr("stroke", "#333")
  .attr("stroke-width", 0.5)
  .attr("class", "choropleth")
  .attr("fill", d => colorScale(d.properties.VIOLENT_CRIMES_PCT_DIFF))
  .attr("opacity", 1);

  // Set up Scrollama
  const scroller = scrollama();

  scroller
    .setup({
      step: ".step",
      offset: 0.1
    })
    .onStepEnter(({ index }) => {
      console.log("Step:", index);
      updateMap(index, data.features);
    });
});

const legendHeight = 160;
const legendWidth = 12;

const legendSvg = d3.select("#legend-svg");

const defs = legendSvg.append("defs");

const gradient = defs.append("linearGradient")
  .attr("id", "legend-gradient-vertical")
  .attr("x1", "0%")
  .attr("y1", "100%")
  .attr("x2", "0%")
  .attr("y2", "0%");

const stops = 10;
for (let i = 0; i <= stops; i++) {
  const t = i / stops;
  gradient.append("stop")
    .attr("offset", `${t * 100}%`)
    .attr("stop-color", d3.interpolateRdBu(1 - t)); // reversed
}

// Color bar
legendSvg.append("rect")
  .attr("x", 30)
  .attr("y", 30)
  .attr("width", legendWidth)
  .attr("height", legendHeight)
  .style("fill", "url(#legend-gradient-vertical)");

// Scale
const legendScale = d3.scaleLinear()
  .domain([-100, 100])
  .range([legendHeight + 30, 30]);

const legendAxis = d3.axisRight(legendScale)
  .ticks(5)
  .tickFormat(d => `${d}%`);

legendSvg.append("g")
  .attr("transform", `translate(${30 + legendWidth}, 0)`)
  .call(legendAxis);

// Title
legendSvg.append("text")
  .attr("x", 0)
  .attr("y", 18)
  .attr("id", 'legend-title')
  .text("Change in Violent Crime");


// Step-based map updates
function updateMap(step, features) {
  if (step === 0){
    svg.selectAll(".choropleth")
    .transition().duration(500)
    .attr("opacity", 1);
  } else if (step === 1) {
    svg.selectAll(".choropleth")
    .transition().duration(500)
    .attr("opacity", d => d.properties.shotspotter === 1 ? 1 : 0.1);
    
  } else if (step === 2) {
    svg.selectAll(".choropleth")
    .transition().duration(500)
    .attr("opacity", d => d.properties.hotspot === 1 ? 1 : 0.1);
 } else if (step === 3) {
    svg.selectAll(".choropleth")
    .transition().duration(500)
    .attr("opacity", d => d.properties.peacekeeper === 1 ? 1 : 0.1); 
 } else if (step === 4) {
    const tooltip = d3.select("#tooltip");
    const choros = svg.selectAll(".choropleth");

    choros.transition().duration(500)
    .attr("opacity", 1)
    
    
    choros.on("mouseover", function (event, d) {
    tooltip
      .style("display", "block")
      .html(`
        <strong>Beat:</strong> ${d.properties.beat_num}<br/>
        <strong>Violent Crimes 2024 YTD:</strong> ${d.properties.VIOLENT_CRIMES_YTD_2024}<br/>
        <strong>Violent Crimes 2025 YTD:</strong> ${d.properties.VIOLENT_CRIMES_YTD_2025}<br/>
        <strong>% Change:</strong> ${Math.round(d.properties.VIOLENT_CRIMES_PCT_DIFF * 10000) / 100}%<br/>
      `);
    d3.select(this).raise().attr("stroke-width", 2); // optional highlight
  })
  .on("mousemove", function (event) {
    tooltip
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mouseout", function () {
    tooltip.style("display", "none");
    d3.select(this).attr("stroke-width", 0.5); // reset
  }); 
 }
}
