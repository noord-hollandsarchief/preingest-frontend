import { createApp } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';
import ConfirmationService from 'primevue/confirmationservice';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Password from 'primevue/password';
import PrimeVue from 'primevue/config';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import App from './App.vue';
import router from './router';
import store from './store';

import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import 'primevue/resources/themes/saga-blue/theme.css';
import 'primevue/resources/primevue.min.css';

const app = createApp(App);

app.use(store);

app.use(router);
app.use(ConfirmationService);
app.use(PrimeVue, { ripple: true });
app.use(ToastService);

app.component('Accordion', Accordion);
app.component('AccordionTab', AccordionTab);
app.component('Button', Button);
app.component('Column', Column);
app.component('ColumnGroup', ColumnGroup);
app.component('ConfirmDialog', ConfirmDialog);
app.component('Checkbox', Checkbox);
app.component('DataTable', DataTable);
app.component('Dialog', Dialog);
app.component('Dropdown', Dropdown);
app.component('InputText', InputText);
app.component('MultiSelect', MultiSelect);
app.component('Password', Password);
app.component('Tag', Tag);
app.component('Textarea', Textarea);
app.component('Toast', Toast);

app.directive('tooltip', Tooltip);

app.mount('#app');
