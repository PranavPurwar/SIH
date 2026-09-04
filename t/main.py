#!/usr/bin/env python3
"""SkillBridge Workflow (Clean Layout, No Stranded Labels, Proper Proportion)

Generates: skillbridge_workflow.png
"""

import graphviz

DOT_SOURCE = r"""
digraph SkillBridgeWorkflow {
    rankdir=TB;
    splines=ortho;
    nodesep=0.55;
    ranksep=0.45;
    fontname="Helvetica";

    // Clean, crisp rectangular cards
    node [
        shape=box,
        style="filled",
        fillcolor="#ffffff",
        color="#2d3748",
        penwidth=1.1,
        fontname="Helvetica",
        fontsize=9,
        width=2.8,
        height=0.55,
        margin="0.10,0.06"
    ];

    edge [
        color="#4a5568",
        penwidth=1.0,
        fontname="Helvetica",
        fontsize=8
    ];

    // Actor
    User [
        label="User\n(Student / Recruiter / Faculty)",
        fillcolor="#edf2f7",
        width=2.2,
        height=0.45
    ];

    // 1. UI Layer
    subgraph cluster_ui {
        label="User Interface (Vue SPA)";
        style="solid";
        color="#718096";
        bgcolor="#f8fafc";
        fontname="Helvetica-Bold";
        fontsize=10;

        RoleGate [
            label="Role Router & Auth\n(JWT: student | recruiter | faculty)",
            shape=diamond,
            fillcolor="#edf2f7",
            width=2.5,
            height=0.6
        ];

        UI_Portals [
            label="Workspaces & Portals\n(Student Radar • Recruiter ATS • Faculty Hub)",
            width=3.6
        ];
    }

    // 2. Dashboards (Middle Left)
    subgraph cluster_dashboards {
        label="Dashboard: Auditing & Results";
        style="solid";
        color="#4a5568";
        bgcolor="#f8fafc";
        fontname="Helvetica-Bold";
        fontsize=10;

        Dash_Audit [
            label="Audit & Verification Views\n• Traceability Matrix (σ Variance)\n• Verified PDF Resumes (pdf-lib)",
            height=0.65
        ];

        Dash_Analytics [
            label="Placement & ATS Telemetry\n• Requisition Pipeline (Applied → Selected)\n• Readiness KPI & Curriculum Gaps",
            height=0.65
        ];
    }

    // 3. Ingestion & Vector Pipeline (Middle Right)
    subgraph cluster_pipeline {
        label="Pipeline Definition & Scoring";
        style="solid";
        color="#4a5568";
        bgcolor="#f8fafc";
        fontname="Helvetica-Bold";
        fontsize=10;

        MistralParse [
            label="Mistral AI Parser\nStructured JSON Entity Extraction"
        ];

        SkillNormalizer [
            label="skill-normalizer.service\nO(1) Map • Levenshtein Resolver"
        ];

        OllamaEmbed [
            label="Ollama Embedding Engine\n768-d nomic-embed-text-v2-moe"
        ];

        VectorScoring [
            label="Vector Engine & Multi-Signal Scoring\n• Dot-Product Cosine Sim (≥ 0.88)\n• Score = ∑(w_i · S_i) / ∑w_active",
            height=0.65
        ];
    }

    // 4. Backend & Database (Bottom Left)
    subgraph cluster_backend {
        label="Backend & Persistence Layer";
        style="solid";
        color="#4a5568";
        bgcolor="#f8fafc";
        fontname="Helvetica-Bold";
        fontsize=10;

        BackendAPI [
            label="Express API Gateway (/api)\nOrchestrator & Assessments Engine"
        ];

        PostgresDB [
            label="PostgreSQL Database\nStudents • Jobs • Applications • Assessments",
            fillcolor="#edf2f7"
        ];

        PgVector [
            label="pgvector & OCW Engine\n768-d HNSW Index • Remedial Cache",
            fillcolor="#edf2f7"
        ];
    }

    // Top Flow
    User -> RoleGate;
    RoleGate -> UI_Portals;

    // UI Branching
    UI_Portals -> Dash_Audit [label="Views"];
    UI_Portals -> MistralParse [label="Upload Resume"];

    // Sequential Right Column Pipeline (Zero Leaping Arrows)
    MistralParse -> SkillNormalizer;
    SkillNormalizer -> OllamaEmbed;
    OllamaEmbed -> VectorScoring;

    // Pipeline Results to Backend
    VectorScoring -> BackendAPI [label="Calibrated Profile"];

    // Backend Core to DB
    BackendAPI -> PostgresDB [dir=both];
    BackendAPI -> PgVector [dir=both];

    // Backend feeds Dashboards
    BackendAPI -> Dash_Audit [label="Fetch Data"];
}
"""


def main():
    src = graphviz.Source(DOT_SOURCE)
    output_path = src.render(
        filename="skillbridge_workflow", format="png", cleanup=True
    )
    print(f"Rendered clean diagram to: {output_path}")


if __name__ == "__main__":
    main()