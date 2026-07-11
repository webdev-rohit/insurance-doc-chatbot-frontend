import { Link } from 'react-router-dom';

interface Props {
  heading: string;
  subheading: string;
  features?: string[];
}

/** The green marketing panel shared by every auth screen (hidden on mobile). */
export function AuthAside({ heading, subheading, features }: Props) {
  return (
    <aside className="auth__aside">
      <Link className="brand" to="/login">
        <span className="brand__logo">🛡️</span>
        <span>Insurance Doc Chatbot</span>
      </Link>
      <div className="auth__pitch">
        <h2>{heading}</h2>
        <p>{subheading}</p>
        {features && features.length > 0 && (
          <ul className="auth__features">
            {features.map((f) => (
              <li key={f}>
                <span className="tick">✓</span> {f}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="auth__foot">© 2026 Insurance Doc Chatbot</div>
    </aside>
  );
}
