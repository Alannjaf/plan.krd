import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("should render button with default variant and size", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
  });

  it("should render button with different variants", () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "destructive");

    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "outline");

    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "ghost");
  });

  it("should render button with different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "sm");

    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "lg");

    rerender(<Button size="icon">Icon</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "icon");
  });

  it("should handle click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("should accept custom className", () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("should render as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
    expect(link).toHaveAttribute("data-slot", "button");
  });

  it("should pass through additional props", () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom label">
        Test
      </Button>
    );

    const button = screen.getByTestId("custom-button");
    expect(button).toHaveAttribute("aria-label", "Custom label");
  });
});
