import os
from dotenv import load_dotenv
from backend.engine import create_engine

# Load environment variables
load_dotenv()

def run_demo():
    # Sample Data
    sample_resume = """
    John Doe
    Software Engineer
    Experience:
    - Built web applications using Python and Django.
    - Managed PostgreSQL databases.
    - Implemented CI/CD pipelines with GitHub Actions.
    Skills: Python, Django, SQL, Git, Docker.
    """
    
    sample_jd = """
    Senior Software Engineer
    Requirements:
    - 5+ years experience with Python and Django.
    - Strong knowledge of Cloud Infrastructure (AWS or GCP).
    - Experience with Kubernetes and Containerization.
    - Ability to lead technical projects.
    """
    
    # Initialize State
    initial_state = {
        "original_resume": sample_resume,
        "job_description": sample_jd,
        "analysis_report": [],
        "draft_bullets": [],
        "audit_feedback": None,
        "iteration_count": 0
    }
    
    # Run Engine
    app = create_engine()
    final_state = app.invoke(initial_state)
    
    # Output Results
    print("\n" + "="*50)
    print("FINAL AUDITED RESUME BULLETS")
    print("="*50)
    for bullet in final_state["draft_bullets"]:
        print(f"• {bullet}")
    print("="*50)
    print(f"Audit Status: {final_state['audit_feedback']}")
    print("="*50)

if __name__ == "__main__":
    run_demo()
