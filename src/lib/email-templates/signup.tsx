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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={{ fontSize: '18px', fontWeight: 700, color: brand.primary, margin: '0 0 16px' }}>
          {siteName}
        </Text>
        <Heading style={heading}>Confirm your email</Heading>
        <Text style={paragraph}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={{ color: brand.primary, textDecoration: 'none', fontWeight: 600 }}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={paragraph}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={{ color: brand.primary, textDecoration: 'none' }}>
            {recipient}
          </Link>
          ) by clicking the button below:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify Email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
