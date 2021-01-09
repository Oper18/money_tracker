from orator.migrations import Migration


class AddAccumulationColumnToPurchaseTable(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('purchases') as table:
            table.integer('accumulation').nullable()

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('purchases') as table:
            table.drop_column('accumulation')
