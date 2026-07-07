//validate ng login form, validate ng register form, validate ng email, validate ng phone number,
//  validate ng password, validate ng confirm password, validate ng address, validate ng city, 
// validate ng state, validate ng zip code, validate ng country

//ginagawa ang validation dahil sa mga requirements ng backend, para hindi magpadala ng invalid data sa backend, 
// at para maiwasan ang errors sa backend
(function (window, $) {
  const rules = {
    isFilled(value) {
      return String(value || '').trim().length > 0;
    },
    //ang process ng regex ay para sa pag-validate ng email, kung ito ay valid na email format
    isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    },
    isPhone(value) {
      // Accepts PH mobile formats: 09171234567 or +639171234567
      const cleaned = String(value || '').trim().replace(/[\s-]/g, '');
      return /^(09\d{9}|\+639\d{9})$/.test(cleaned);
    },
    
    minLength(value, length) {
      return String(value || '').trim().length >= length;
    },
    maxLength(value, length) {
      return String(value || '').trim().length <= length;
    },
  };

 //ineensure nito na mayroong error element sa tabi ng field para ipakita ang validation error message
  function ensureErrorEl($field) {
    let $error = $field.next('.field-error');
    if (!$error.length) {
      $error = $('<small class="field-error"></small>');
      $field.after($error);
    }
    return $error;
  }

  //ginagawa nito ang pag-attach ng validation sa form, at pag-validate ng bawat field base sa mga rules na ibinigay
  function attachFormValidation(formSelector, fieldRules) {
    const $form = $(formSelector);
    if (!$form.length) {
      return { validate: () => true };
    }

    
    function validateField(selector) {
      const $field = $form.find(selector);
      if (!$field.length) {
        return true;
      }

      const value = $field.val();
      const validators = fieldRules[selector] || [];
      const $error = ensureErrorEl($field);

      for (const validator of validators) {
        if (!validator.test(value)) {
          $field.addClass('field--invalid');
          $error.text(validator.message).show();
          return false;
        }
      }

      $field.removeClass('field--invalid');
      $error.hide().text('');
      return true;
    }

    // Vinavalidate nito ang lahat ng fields sa form, at ibinabalik ang true kung lahat ay valid, o false kung may invalid field
    function validateAll() {
      let isValid = true;
      Object.keys(fieldRules).forEach((selector) => {
        if (!validateField(selector)) {
          isValid = false;
        }
      });
      return isValid;
    }

    Object.keys(fieldRules).forEach((selector) => {
      // Validate on focusout (blur) event, ibigsabihin kapag nawala ang focus sa field, ie-validate ang field
      $form.on('focusout', selector, () => validateField(selector));

     // Validate on input event, ibig sabihin kapag may input sa field, ie-validate ang field kung ito ay may class na 'field--invalid'
      $form.on('input', selector, function () {
        if ($(this).hasClass('field--invalid')) {
          validateField(selector);
        }
      });
    });

    return { validate: validateAll };
  }

  window.FurnitureShopValidation = Object.assign({}, rules, { attachFormValidation });
})(window, jQuery);