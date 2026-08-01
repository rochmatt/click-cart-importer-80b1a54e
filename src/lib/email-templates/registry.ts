import type { ComponentType } from 'react'
import { template as orderCancellationTemplate } from './order-cancellation'
import { template as orderConfirmationTemplate } from './order-confirmation'
import { template as orderRefundUpdateTemplate } from './order-refund-update'
import { template as orderStatusUpdateTemplate } from './order-status-update'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-confirmation': orderConfirmationTemplate,
  'order-status-update': orderStatusUpdateTemplate,
  'order-cancellation': orderCancellationTemplate,
  'order-refund-update': orderRefundUpdateTemplate,
}
