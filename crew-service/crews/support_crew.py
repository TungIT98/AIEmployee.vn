"""
Support Crew - Handles customer support requests with hierarchical process
"""
from crewai import Agent, Task
from crewai.tasks import TaskOutput
from crews.base_crew import BaseCrew
from typing import List, Dict, Any


class SupportCrew(BaseCrew):
    description = "Handles customer support tickets and resolves issues efficiently"

    def __init__(self):
        super().__init__()

        # Support Manager Agent - Coordinates support operations
        support_manager = Agent(
            role="Support Manager",
            goal="Ensure all customer issues are resolved efficiently and satisfactorily",
            backstory="""You are an experienced support manager who understands customer
            pain points and knows how to coordinate resources to resolve issues quickly.

            You excel at:
            - Ticket triage and prioritization
            - Resource allocation
            - Escalation decisions
            - Customer satisfaction monitoring
            - Team coordination""",
            verbose=True,
            allow_delegation=True
        )

        # Technical Support Agent - Handles technical issues
        tech_support = Agent(
            role="Technical Support Specialist",
            goal="Diagnose and resolve technical issues with clear solutions",
            backstory="""You are a technical support expert with deep knowledge of
            the product. You can quickly identify issues and provide step-by-step solutions.

            Your expertise includes:
            - Troubleshooting and diagnostics
            - Step-by-step solution guides
            - Technical documentation
            - Root cause analysis
            - Preventive recommendations""",
            verbose=True,
            allow_delegation=False
        )

        # Customer Success Agent - Ensures satisfaction
        success_agent = Agent(
            role="Customer Success Specialist",
            goal="Ensure customer satisfaction and prevent churn through proactive engagement",
            backstory="""You are a customer success expert who understands customer
            lifecycle and knows how to turn support interactions into loyalty opportunities.

            You specialize in:
            - Customer onboarding and training
            - Usage optimization
            - Retention strategies
            - Feedback collection
            - Relationship building""",
            verbose=True,
            allow_delegation=False
        )

        self.agents = [support_manager, tech_support, success_agent]

        # Define tasks
        self.tasks = self._create_tasks()

    def _create_tasks(self) -> List[Task]:
        """Create the support handling pipeline tasks"""

        # Task 1: Ticket Triage and Assessment
        triage_task = Task(
            description="""Analyze the support ticket and determine the best course of action:
            1. Understand the customer's issue and urgency
            2. Categorize the issue type (technical, billing, feature request, etc.)
            3. Assess complexity and required expertise
            4. Determine priority level (critical, high, medium, low)
            5. Decide if escalation is needed

            Ticket: {task}
            Output: Triaged ticket with category, priority, and assigned handler""",
            agent=self.agents[0],  # support_manager
            expected_output="Triaged ticket with category, priority level, and handling approach"
        )

        # Task 2: Technical Resolution (if applicable)
        technical_task = Task(
            description="""For technical issues, diagnose and resolve:
            1. Gather additional information if needed
            2. Identify root cause of the issue
            3. Develop step-by-step solution
            4. Provide preventive measures
            5. Document the resolution for future reference

            Ticket context: {task}
            Context from triage: {triage_output}
            Output: Technical resolution with steps and prevention tips""",
            agent=self.agents[1],  # tech_support
            expected_output="Technical resolution document with troubleshooting steps and preventive recommendations",
            context=[triage_task]
        )

        # Task 3: Customer Success Follow-up
        success_task = Task(
            description="""After resolution, ensure customer satisfaction:
            1. Confirm the customer is satisfied with the resolution
            2. Provide additional tips for optimal product usage
            3. Identify opportunities for training or upselling
            4. Collect feedback on the support experience
            5. Set up check-in if needed

            Ticket context: {task}
            Resolution: {technical_output}
            Output: Customer satisfaction confirmation with follow-up actions""",
            agent=self.agents[2],  # success_agent
            expected_output="Customer satisfaction report with follow-up actions and feedback",
            context=[technical_task]
        )

        return [triage_task, technical_task, success_task]

    def execute_with_streaming(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the support crew with streaming"""
        from crewai import Crew, Process

        # Create crew with hierarchical process for support
        self._crew = Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.hierarchical,  # Manager coordinates
            manager_agent=self.agents[0],  # Support manager coordinates
            verbose=True,
            output_log_file="crewai_support_log.txt"
        )

        # Execute
        result = self._crew.kickoff(inputs=inputs)

        return {
            "result": str(result),
            "tasks_output": [
                {
                    "task": task.description[:50] + "...",
                    "output": str(task.output) if hasattr(task, 'output') else None
                }
                for task in self.tasks
            ]
        }
