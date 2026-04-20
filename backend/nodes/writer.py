import os
from langchain_litellm import ChatLiteLLM
from backend.state import GraphState

def writer_node(state: GraphState) -> GraphState:
    """
    Rewrites resume bullets using the STAR method. 
    Each gap in analysis_report gets exactly ONE corresponding bullet.
    """
    print("--- WRITER: Documenting Gaps ---")
    
    resume = state["original_resume"]
    gaps_list = state["analysis_report"]
    gaps_text = "\n".join(gaps_list)
    feedback = state.get("audit_feedback")
    
    feedback_section = ""
    if feedback and "REJECTED" in feedback.upper():
        feedback_section = f"\nPREVIOUS AUDIT FEEDBACK (CRITICAL): {feedback}\nAvoid the mistakes mentioned above."
    
    prompt = f"""
    You are an expert resume writer. Create exactly {len(gaps_list)} resume bullets.
    Each bullet MUST correspond 1:1 to one of these identified gaps:
    {gaps_text}

    INSTRUCTIONS:
    1. For each gap, write one professional resume bullet point.
    2. Each bullet should implicitly follow the STAR method (Situation, Task, Action, Result) but MUST be written as a single, seamless sentence or paragraph.
    3. DO NOT use explicit labels like "Situation:", "Task:", "Action:", or "Result:".
    4. The bullet MUST explicitly mention the gap keyword/skill.
    5. Stay grounded in the original resume experience; do not fabricate projects.
    6. {feedback_section}
    7. DO NOT use Markdown bolding (no ** symbols).
    
    Original Resume for context:
    {resume}
    
    Output exactly {len(gaps_list)} bullets, each on a new line.
    """
    
    model_name = os.getenv("LLM_MODEL", "ollama/llama3")
    base_url = os.getenv("LLM_BASE_URL")
    
    llm = ChatLiteLLM(model=model_name, api_base=base_url)
    
    response = llm.invoke(prompt)
    content = response.content
    
    # Split by newlines and clean up
    bullets = [line.strip("- ").strip() for line in content.split("\n") if line.strip()]
    
    # If the model didn't provide enough bullets, we'll try to keep what we have
    return {**state, "draft_bullets": bullets}
