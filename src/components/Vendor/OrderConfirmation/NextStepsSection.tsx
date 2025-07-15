import React from "react";
import { NextStep } from "../../../types/order-confirmation";

interface Props {
  nextSteps: NextStep[];
}

const NextStepsSection: React.FC<Props> = ({ nextSteps }) => {
  return (
    <section className="next-steps-section">
      <h2>Next Steps</h2>
      <ol>
        {nextSteps.map((step) => (
          <li key={step.id} style={{ opacity: step.completed ? 0.5 : 1 }}>
            <strong>{step.title}</strong>: {step.description}
            {step.dueDate && (
              <span> (Due: {new Date(step.dueDate).toLocaleDateString()})</span>
            )}
            {step.completed && <span> ✔</span>}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default NextStepsSection;
