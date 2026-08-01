import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import {
  brand,
  container,
  footer,
  heading,
  main,
  paragraph,
} from './theme'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={{ fontSize: '18px', fontWeight: 700, color: brand.primary, margin: '0 0 16px' }}>
          PasarPilih
        </Text>
        <Heading style={heading}>Confirm reauthentication</Heading>
        <Text style={paragraph}>Use the code below to confirm your identity:</Text>
        <Text
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '28px',
            fontWeight: 700,
            color: brand.text,
            letterSpacing: '0.15em',
            margin: '8px 0 24px',
          }}
        >
          {token}
        </Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
