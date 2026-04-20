import os
from langchain_litellm import ChatLiteLLM
from backend.state import GraphState

def writer_node(state: GraphState) -> GraphState:
    """
    Rewrites resume bullets using the STAR method based on identified gaps and auditor feedback.
    """
    print("--- WRITER: Rewriting bullets ---")
    
    resume = state["original_resume"]
    gaps = "\n".join(state["analysis_report"])
    feedback = state.get("audit_feedback")
    
    feedback_section = ""
    if feedback and "REJECTED" in feedback.upper():
        feedback_section = f"\nPREVIOUS AUDIT FEEDBACK (CRITICAL): {feedback}\nAvoid the mistakes mentioned above."
    
    prompt = f"""
    Rewrite 3 resume bullets using the STAR method to address these gaps: {gaps}.
    {feedback_section}
    
    CRITICAL: Stay grounded in the original experience. DO NOT hallucinate tools not present in the resume.
    
    Original Resume: {resume}
    
    Output only the 3 rewritten bullets.
    """
    
    model_name = os.getenv("LLM_MODEL", "ollama/llama3")
    base_url = os.getenv("LLM_BASE_URL")
    
    llm = ChatLiteLLM(model=model_name, api_base=base_url)
    
    response = llm.invoke(prompt)
    content = response.content
    bullets = [line.strip("- ").strip() for line in content.split("\n") if line.strip()]
    
    return {**state, "draft_bullets": bullets}
