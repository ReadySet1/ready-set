import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface OnDemandOrdersPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const OnDemandOrdersPagination: React.FC<
  OnDemandOrdersPaginationProps
> = ({ currentPage, totalPages, onPageChange }) => {
  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(
          <PaginationItem key={i} className="hidden sm:block">
            <PaginationLink
              onClick={() => onPageChange(i)}
              isActive={currentPage === i}
              className={`cursor-pointer text-sm ${currentPage === i ? 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200' : 'hover:bg-slate-200'}`}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
        );
      }
    } else {
      const leftBound = Math.max(1, currentPage - 2);
      const rightBound = Math.min(totalPages, leftBound + 4);

      if (leftBound > 1) {
        pageNumbers.push(
          <PaginationItem key={1} className="hidden sm:block">
            <PaginationLink
              onClick={() => onPageChange(1)}
              className="cursor-pointer text-sm hover:bg-slate-200"
            >
              1
            </PaginationLink>
          </PaginationItem>,
        );
        if (leftBound > 2) {
          pageNumbers.push(<PaginationEllipsis key="leftEllipsis" className="hidden sm:flex" />);
        }
      }

      for (let i = leftBound; i <= rightBound; i++) {
        pageNumbers.push(
          <PaginationItem key={i} className="hidden sm:block">
            <PaginationLink
              onClick={() => onPageChange(i)}
              isActive={currentPage === i}
              className={`cursor-pointer text-sm ${currentPage === i ? 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200' : 'hover:bg-slate-200'}`}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
        );
      }

      if (rightBound < totalPages) {
        if (rightBound < totalPages - 1) {
          pageNumbers.push(<PaginationEllipsis key="rightEllipsis" className="hidden sm:flex" />);
        }
        pageNumbers.push(
          <PaginationItem key={totalPages} className="hidden sm:block">
            <PaginationLink
              onClick={() => onPageChange(totalPages)}
              className="cursor-pointer text-sm hover:bg-slate-200"
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>,
        );
      }
    }

    return pageNumbers;
  };

  return (
    <Pagination>
      <PaginationContent className="flex-wrap gap-1">
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(currentPage - 1)}
            className={`text-sm ${
              currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"
            }`}
          />
        </PaginationItem>
        {renderPageNumbers()}
        {/* Mobile: Show current page info */}
        <PaginationItem className="sm:hidden">
          <span className="px-3 py-2 text-sm text-slate-600">
            {currentPage} of {totalPages}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(currentPage + 1)}
            className={`text-sm ${
              currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"
            }`}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export default OnDemandOrdersPagination;
