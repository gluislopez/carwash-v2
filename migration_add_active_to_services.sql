-- Script para habilitar la funcionalidad de Ocultar/Mostrar servicios en el Portal
-- Corrección: Añade la columna 'active' a la tabla 'services'

ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Asegurar que los servicios existentes sean visibles por defecto
UPDATE services SET active = true WHERE active IS NULL;

-- Notificar éxito
COMMENT ON COLUMN services.active IS 'Controla si el servicio es visible como extra en el portal del cliente';
