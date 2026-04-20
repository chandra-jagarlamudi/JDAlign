from typing import TypedDict, List, Optional

class GraphState(TypedDict):
    """
    Represents the state of our agentic graph.
    """
    original_resume: str
    job_description: str
    analysis_report: List[str]  # Gaps identified by Critic
    draft_bullets: List[str]    # Proposed rewrites by Writer
    audit_feedback: Optional[str] # "Approved" or "Fix this: ..."
    iteration_count: int        # Guard against infinite loops
    user_approved: Optional[bool] # For HITL (Full Resume Rewrite)
    full_resume: Optional[str]  # The reconstructed resume
