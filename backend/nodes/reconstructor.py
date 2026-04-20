import os
from langchain_litellm import ChatLiteLLM
from backend.state import GraphState

def reconstructor_node(state: GraphState) -> GraphState:
    """
    Reconstructs the full resume by incorporating the optimized STAR bullets 
    into the original resume structure.
    """
    print("--- RECONSTRUCTOR: Finalizing full resume ---")
    
    original = state["original_resume"]
    bullets = "\n".join(state["draft_bullets"])
    jd = state["job_description"]
    
    prompt = f"""
    You are an expert resume writer. Your task is to rewrite the ORIGINAL RESUME by 
    incorporating the OPTIMIZED STAR BULLETS provided below.
    
    ORIGINAL RESUME:
    {original}
    
    OPTIMIZED STAR BULLETS:
    {bullets}
    
    JOB DESCRIPTION (for context):
    {jd}
    
    INSTRUCTIONS:
    1. Keep the original header, contact info, and education sections as is.
    2. Replace the relevant experience sections with the OPTIMIZED STAR BULLETS.
    3. Ensure the tone is professional and the formatting is clean.
    4. Do not add any information that wasn't in the original resume or the optimized bullets.
    
    Output the FULL rewritten resume.
    """
    
    model_name = os.getenv("LLM_MODEL", "ollama/llama3")
    base_url = os.getenv("LLM_BASE_URL")
    
    llm = ChatLiteLLM(model=model_name, api_base=base_url)
    
    response = llm.invoke(prompt)
    full_text = response.content.strip()
    
    return {**state, "full_resume": full_text}
