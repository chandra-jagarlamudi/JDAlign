import os
from langchain_litellm import ChatLiteLLM
from backend.state import GraphState

def auditor_node(state: GraphState) -> GraphState:
    """
    Validates the rewritten bullets against the original resume to prevent hallucinations.
    """
    print("--- AUDITOR: Validating content ---")
    
    original = state["original_resume"]
    drafts = "\n".join(state["draft_bullets"])
    
    prompt = f"""
    Audit these bullets against the original resume for hallucinations.
    Original: {original}
    Drafts: {drafts}
    
    Respond with 'APPROVED' or 'REJECTED: [brief reason]'.
    """
    
    model_name = os.getenv("LLM_MODEL", "ollama/llama3")
    base_url = os.getenv("LLM_BASE_URL")
    
    llm = ChatLiteLLM(model=model_name, api_base=base_url)
    
    response = llm.invoke(prompt)
    feedback = response.content.strip()
    
    return {**state, "audit_feedback": feedback, "iteration_count": state["iteration_count"] + 1}
