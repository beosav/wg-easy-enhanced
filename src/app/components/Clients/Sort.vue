<template>
  <div class="flex">
    <SelectRoot v-model="sortProperty">
      <SelectTrigger
        class="inline-flex items-center gap-2 rounded-l border-2 border-r-0 border-red-800 bg-red-800 px-4 py-2 text-white transition hover:border-red-600 hover:bg-red-600"
        :aria-label="$t('client.sort')"
      >
        <span class="text-sm">{{ $t('client.sort') }}:</span>
        <SelectValue />
        <IconsArrowDown class="w-3" />
      </SelectTrigger>

      <SelectPortal>
        <SelectContent
          class="z-[100] min-w-48 rounded bg-gray-300 shadow-lg dark:bg-neutral-500"
          position="popper"
        >
          <SelectViewport class="p-2">
            <SelectItem
              v-for="option in sortOptions"
              :key="option.value"
              :value="option.value"
              class="relative flex h-8 cursor-pointer items-center rounded px-3 text-sm leading-none outline-none hover:bg-red-800 hover:text-white data-[state=checked]:bg-red-800 data-[state=checked]:text-white dark:text-white"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>

    <BasePrimaryButton
      class="rounded-l-none px-3"
      :title="
        globalStore.sortClient
          ? $t('client.sortAscending')
          : $t('client.sortDescending')
      "
      @click="toggleSort"
    >
      <IconsArrowDown v-if="globalStore.sortClient" class="w-4" />
      <IconsArrowUp v-else class="w-4" />
    </BasePrimaryButton>
  </div>
</template>

<script setup lang="ts">
const globalStore = useGlobalStore();
const clientsStore = useClientsStore();
const { t } = useI18n();

const sortProperty = computed({
  get: () => globalStore.sortClientProperty,
  set: (value) => {
    globalStore.sortClientProperty = value;
    clientsStore.refresh().catch(console.error);
  },
});

const sortOptions = computed(() => [
  { value: 'name', label: t('client.sortName') },
  {
    value: 'transferTxCurrent',
    label: t('client.sortDownloadSpeed'),
  },
  { value: 'transferTx', label: t('client.sortTotalDownload') },
  {
    value: 'transferRxCurrent',
    label: t('client.sortUploadSpeed'),
  },
  { value: 'transferRx', label: t('client.sortTotalUpload') },
]);

function toggleSort() {
  globalStore.sortClient = !globalStore.sortClient;
  clientsStore.refresh().catch(console.error);
}
</script>
