"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Order, StatusFilter } from "./types";

const useCateringOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      const apiUrl = `/api/orders/catering-orders?page=${page}&limit=${limit}${
        statusFilter !== "all" ? `&status=${statusFilter}` : ""
      }`;
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch catering orders");
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setOrders(data);
          setTotalPages(Math.ceil(data.length / limit));
        } else if (data && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setTotalPages(Math.ceil((data.totalCount || data.orders.length) / limit));
        } else {
          throw new Error("Unexpected data format received from API");
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [page, limit, statusFilter]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleStatusFilter = useCallback((status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const result = useMemo(() => ({
    orders,
    isLoading,
    error,
    page,
    totalPages,
    statusFilter,
    handlePageChange,
    handleStatusFilter,
  }), [orders, isLoading, error, page, totalPages, statusFilter, handlePageChange, handleStatusFilter]);


  return result;
};

export default useCateringOrders;