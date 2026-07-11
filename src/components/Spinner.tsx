export function Spinner({ large = false }: { large?: boolean }) {
  return <span className={large ? 'spinner spinner--lg' : 'spinner'} aria-hidden="true" />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner large />
    </div>
  );
}
