export default function Body({
  className,
  ...props
}: React.HtmlHTMLAttributes<HTMLDivElement>) {
  return (
    <>
      <div className="bg-dark">
        <div
          className={"max-w-7xl mx-auto px-6 relative"}
          {...props}
        >
          {props.children}
        </div>
      </div>
    </>
  );
}
