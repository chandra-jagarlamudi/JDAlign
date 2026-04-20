import os
from langchain_litellm import ChatLiteLLM
from backend.state import GraphState

def critic_node(state: GraphState) -> GraphState:
    """
    Analyzes the resume against the job description to identify missing keywords or skills.
    """
    print("--- CRITIC: Identifying gaps ---")
    
    resume = state["original_resume"]
    jd = state["job_description"]
    
    prompt = f"""
    Compare Resume vs JD. List 3-5 critical missing skills or keywords as a simple list.
    
    Resume: {resume}
    JD: {jd}
    
    Output only the list.
    """
    
    model_name = os.getenv("LLM_MODEL", "ollama/llama3")
    base_url = os.getenv("LLM_BASE_URL")
    
    # Only pass base_url if it's explicitly provided and not for a standard cloud provider
    # unless it's a specific requirement for OpenRouter/etc.
    llm = ChatLiteLLM(model=model_name, api_base=base_url)
    
    response = llm.invoke(prompt)
    content = response.content
    gaps = [line.strip("- ").strip() for line in content.split("\n") if line.strip()]
    
    return {**state, "analysis_report": gaps}
