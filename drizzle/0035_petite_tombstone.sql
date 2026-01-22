ALTER TABLE "legal_documents" RENAME TO "contracts";--> statement-breakpoint
ALTER TABLE "contract_projects" DROP CONSTRAINT "contract_projects_contract_id_legal_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "legal_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "legal_documents_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "legal_documents_signed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "invoice_file_type";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "pdf_file_type";--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "file_type";