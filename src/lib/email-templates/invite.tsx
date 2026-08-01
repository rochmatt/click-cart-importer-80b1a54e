import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'
import {
  brand,
  button,
  container,
  footer,
  heading,
  main,
  paragraph,
} from './theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={{ fontSize: '18px', fontWeight: 700, color: brand.primary, margin: '0 0 16px' }}>
          {siteName}
        </Text>
        <Heading style={heading}>You've been invited</Heading>
        <Text style={paragraph}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={{ color: brand.primary, textDecoration: 'none', fontWeight: 600 }}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
