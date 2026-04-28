"""
Sales Crew - Handles sales leads and conversions
"""
from crewai import Agent
from crews.base_crew import BaseCrew


class SalesCrew(BaseCrew):
    description = "Manages sales pipeline, qualifies leads, and closes deals"

    def __init__(self):
        super().__init__()

        # Sales Manager Agent
        sales_manager = Agent(
            role="Sales Manager",
            goal="Maximize sales conversion while maintaining healthy customer relationships",
            backstory="""You are an experienced sales manager who understands the full
            sales cycle. You know how to coach the team and optimize the pipeline.""",
            verbose=True,
            allow_delegation=True
        )

        # Lead Qualifier Agent
        lead_qualifier = Agent(
            role="Lead Qualification Specialist",
            goal="Qualify leads and route them to the right sales path",
            backstory="""You are an expert at qualifying leads using BANT or similar frameworks.
            You quickly assess if a lead is ready to buy and route them appropriately.""",
            verbose=True,
            allow_delegation=False
        )

        # Closing Agent
        closing_agent = Agent(
            role="Sales Closer",
            goal="Close deals and achieve revenue targets",
            backstory="""You are a top-performing sales closer with a track record of
            exceeding targets. You excel at handling objections and closing complex deals.""",
            verbose=True,
            allow_delegation=False
        )

        self.agents = [sales_manager, lead_qualifier, closing_agent]

    def _get_manager_agent(self):
        """Sales crew uses sales_manager as manager"""
        return self.agents[0]
