import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

describe("Card Components", () => {
  describe("Card", () => {
    it("should render card with children", () => {
      render(
        <Card>
          <div>Card content</div>
        </Card>
      );
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("should accept custom className", () => {
      const { container } = render(
        <Card className="custom-card">
          <div>Content</div>
        </Card>
      );
      const card = container.querySelector('[data-slot="card"]');
      expect(card).toHaveClass("custom-card");
    });
  });

  describe("CardHeader", () => {
    it("should render card header", () => {
      render(
        <Card>
          <CardHeader>Header</CardHeader>
        </Card>
      );
      expect(screen.getByText("Header")).toBeInTheDocument();
    });
  });

  describe("CardTitle", () => {
    it("should render card title", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });
  });

  describe("CardDescription", () => {
    it("should render card description", () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText("Card description")).toBeInTheDocument();
    });
  });

  describe("CardContent", () => {
    it("should render card content", () => {
      render(
        <Card>
          <CardContent>Card content</CardContent>
        </Card>
      );
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });
  });

  describe("CardFooter", () => {
    it("should render card footer", () => {
      render(
        <Card>
          <CardFooter>Footer</CardFooter>
        </Card>
      );
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });
  });

  describe("Complete Card Structure", () => {
    it("should render complete card with all parts", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });
  });
});
