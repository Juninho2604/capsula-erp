-- Hora de entrega solicitada para pedidos PICKUP/DELIVERY.
-- Capturada en POS al abrir el pickup tab o al cobrar el delivery; impresa
-- en la comanda de cocina/barra para que prioricen vs. los pedidos "ASAP".
-- Nullable: si la cajera no la captura, la cocina trata el pedido como
-- "lo antes posible" como hasta ahora.

ALTER TABLE "SalesOrder"
  ADD COLUMN "scheduledDeliveryTime" TIMESTAMP(3);
