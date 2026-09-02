async function populate() {
  const jobs = [
    {
      title: "Senior Kotlin Engineer (Multiplatform)",
      company: "JetBrains (Mock)",
      description: "Looking for an expert in JVM internals, Kotlin Multiplatform, and backend frameworks like Ktor.",
      required_skills: [
        { skill: "Kotlin", min_depth: 0.8 },
        { skill: "JVM", min_depth: 0.75 },
        { skill: "Ktor", min_depth: 0.7 },
        { skill: "Concurrency", min_depth: 0.7 }
      ],
      stipend: "$150k - $200k",
      eligibility: "Senior/Expert"
    },
    {
      title: "Systems Programmer",
      company: "Red Hat (Mock)",
      description: "We need a low-level wizard to work on Linux kernel features, process virtualization, and custom glibc builds.",
      required_skills: [
        { skill: "C", min_depth: 0.85 },
        { skill: "Linux Kernel", min_depth: 0.8 },
        { skill: "Virtualization", min_depth: 0.75 },
        { skill: "glibc", min_depth: 0.8 },
        { skill: "Rust", min_depth: 0.6 }
      ],
      stipend: "$130k - $180k",
      eligibility: "Systems Engineer"
    },
    {
      title: "AI Systems Architect",
      company: "OpenAI (Mock)",
      description: "Build robust AI infrastructure, RAG pipelines, and integrate LLMs using GraphRAG and vector databases.",
      required_skills: [
        { skill: "Python", min_depth: 0.8 },
        { skill: "LLM Agents", min_depth: 0.75 },
        { skill: "GraphRAG", min_depth: 0.8 },
        { skill: "Neo4j", min_depth: 0.7 }
      ],
      stipend: "$180k - $250k",
      eligibility: "AI Architect"
    }
  ];

  console.log("Creating 3 sample jobs...");
  for (const job of jobs) {
    try {
      const res = await fetch("http://localhost:4000/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job)
      });
      const data = await res.json();
      console.log(`- Created job: ${job.title} (${res.status})`);
    } catch (e) {
      console.error("Failed to create job:", e.message);
    }
  }

  console.log("\nStarting MIT OCW Scraper (department='all', limit=50)...");
  try {
    const res = await fetch("http://localhost:4000/api/courses/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: "all", limit: 50, concurrency: 10 })
    });
    const data = await res.json();
    console.log(`- Scraper finished: ${data.data?.message || 'Done'} (${res.status})`);
  } catch (e) {
    console.error("Scraper failed:", e.message);
  }
}

populate();
