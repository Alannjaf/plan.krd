import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input Component", () => {
  it("should render input with default props", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("should render input with placeholder", () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toBeInTheDocument();
  });

  it("should handle value changes", async () => {
    const user = userEvent.setup();
    render(<Input />);
    const input = screen.getByRole("textbox");
    
    await user.type(input, "Hello");
    expect(input).toHaveValue("Hello");
  });

  it("should handle onChange events", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Input onChange={handleChange} />);
    const input = screen.getByRole("textbox");
    
    await user.type(input, "Test");
    expect(handleChange).toHaveBeenCalled();
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Input disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("should accept custom className", () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom-class");
  });

  it("should accept different input types", () => {
    const { rerender, container } = render(<Input type="email" />);
    let input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "email");

    rerender(<Input type="password" />);
    // Password inputs might not have textbox role, so check by type attribute
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it("should accept defaultValue", () => {
    render(<Input defaultValue="Default value" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Default value");
  });

  it("should be read-only when readOnly prop is true", () => {
    render(<Input readOnly />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readOnly");
  });
});
