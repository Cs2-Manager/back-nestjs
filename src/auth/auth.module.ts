import { Module } from '@nestjs/common'

import { IdentityVerifierService } from './identity-verifier.service'
import { JwtVerifierService } from './jwt-verifier.service'
import { FlaskIdentityClient } from './flask-identity.client'

@Module({
  providers: [JwtVerifierService, IdentityVerifierService, FlaskIdentityClient],
  exports: [JwtVerifierService, IdentityVerifierService],
})
export class AuthModule {}
